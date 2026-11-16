import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import { loadBotToken } from "../_shared/channels/delivery.ts";
import {
  TelegramError,
  postToChannel,
} from "../../../connectors/telegram/index.ts";
import {
  InstagramError,
  isExpiredToken,
  publish,
  publishingQuota,
  refreshToken,
  type InstagramFormat,
} from "../../../connectors/instagram/index.ts";

/**
 * Publishes the posts that are due: claims each target once
 * (claim_due_posts), posts it to the Telegram channel or the Instagram
 * account, and records the outcome; a post's status follows its targets.
 * Also refreshes Instagram tokens that end within 10 days.
 * Service role only (a scheduled job, or scripts/channels-dev.mjs).
 * → { published, failed, refreshed }
 */

const POST_MEDIA_BUCKET = "post_media";
const SIGNED_URL_SECONDS = 3600;
const REFRESH_BEFORE_DAYS = 10;
const DAY_MS = 24 * 3600 * 1000;

interface ClaimedTarget {
  target_id: number;
  post_id: number;
  business_id: string;
  account_id: number;
  account_kind: "telegram_channel" | "instagram";
  external_id: string;
  format: InstagramFormat;
  text: string;
  media: { path: string; mime: string }[];
}

/** A failure with a code the interface explains in plain words. */
class PublishError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PublishError";
  }
}

interface Outcome {
  externalId: string;
  url: string | null;
}

const isVideo = (mime: string) => mime.startsWith("video/");

const publishToTelegram = async (target: ClaimedTarget): Promise<Outcome> => {
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("business_id", target.business_id)
    .eq("kind", "telegram")
    .eq("enabled", true)
    .maybeSingle();
  const token = channel ? await loadBotToken(channel.id) : null;
  if (!token) throw new PublishError("no_bot");
  const media = [];
  for (const item of target.media) {
    const { data, error } = await supabaseAdmin.storage
      .from(POST_MEDIA_BUCKET)
      .download(item.path);
    if (error || !data) throw new PublishError("media_missing");
    media.push({
      file: data,
      fileName: item.path.split("/").at(-1) ?? "file",
      isVideo: isVideo(item.mime),
    });
  }
  const messageId = await postToChannel(
    target.external_id,
    target.text,
    media,
    {
      fetch,
      settings: { botToken: token },
    },
  );
  const { data: account } = await supabaseAdmin
    .from("marketing_accounts")
    .select("name")
    .eq("id", target.account_id)
    .single();
  const username = account?.name?.startsWith("@")
    ? account.name.slice(1)
    : null;
  return {
    externalId: String(messageId),
    url: username ? `https://t.me/${username}/${messageId}` : null,
  };
};

const publishToInstagram = async (target: ClaimedTarget): Promise<Outcome> => {
  const { data: secret } = await supabaseAdmin
    .from("marketing_secrets")
    .select("access_token")
    .eq("account_id", target.account_id)
    .maybeSingle();
  if (!secret) throw new PublishError("instagram_not_connected");
  const context = { fetch, settings: { access_token: secret.access_token } };
  const quota = await publishingQuota(target.external_id, context);
  if (quota.total != null && quota.used >= quota.total) {
    throw new PublishError("instagram_limit");
  }
  const media = [];
  for (const item of target.media) {
    const { data, error } = await supabaseAdmin.storage
      .from(POST_MEDIA_BUCKET)
      .createSignedUrl(item.path, SIGNED_URL_SECONDS);
    if (error || !data) throw new PublishError("media_missing");
    if (!data.signedUrl.startsWith("https://")) {
      // Instagram downloads the media itself: it needs a public https address
      throw new PublishError("instagram_local");
    }
    media.push({ url: data.signedUrl, isVideo: isVideo(item.mime) });
  }
  const { id, permalink } = await publish(
    {
      userId: target.external_id,
      format: target.format,
      caption: target.text,
      media,
    },
    context,
  );
  return { externalId: id, url: permalink };
};

/**
 * Why a target failed, for the post list: a code the interface translates
 * (crm.marketing.errors.<code>), or the service's own words.
 */
const describe = (failure: unknown): string => {
  if (failure instanceof PublishError) return failure.code;
  if (isExpiredToken(failure)) return "token_expired";
  if (
    failure instanceof TelegramError &&
    /chat not found|kicked|not enough rights|forbidden/i.test(
      failure.description,
    )
  ) {
    return "telegram_channel";
  }
  if (failure instanceof TelegramError || failure instanceof InstagramError) {
    return failure.description.slice(0, 500);
  }
  return "unknown";
};

/** Refreshes Instagram tokens that end soon (at most once a day each). */
const refreshTokens = async (): Promise<number> => {
  const now = Date.now();
  const { data } = await supabaseAdmin
    .from("marketing_secrets")
    .select("account_id, access_token")
    .lt(
      "token_expires_at",
      new Date(now + REFRESH_BEFORE_DAYS * DAY_MS).toISOString(),
    )
    .lt("refreshed_at", new Date(now - DAY_MS).toISOString());
  let refreshed = 0;
  for (const row of data ?? []) {
    try {
      const fresh = await refreshToken({
        fetch,
        settings: { access_token: row.access_token },
      });
      await supabaseAdmin
        .from("marketing_secrets")
        .update({
          access_token: fresh.access_token,
          token_expires_at: new Date(
            now + fresh.expires_in * 1000,
          ).toISOString(),
          refreshed_at: new Date(now).toISOString(),
        })
        .eq("account_id", row.account_id);
      refreshed++;
    } catch (failure) {
      console.error(
        `token refresh of account ${row.account_id} failed:`,
        describe(failure),
      );
      await supabaseAdmin
        .from("marketing_secrets")
        .update({ refreshed_at: new Date(now).toISOString() })
        .eq("account_id", row.account_id);
    }
  }
  return refreshed;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" || !(await isServiceRequest(req))) {
    return createErrorResponse(401, "Unauthorized");
  }
  const { data, error } = await supabaseAdmin.rpc("claim_due_posts");
  if (error) return createErrorResponse(500, error.message);
  const outcome = { published: 0, failed: 0, refreshed: 0 };
  for (const target of (data ?? []) as ClaimedTarget[]) {
    try {
      const result =
        target.account_kind === "instagram"
          ? await publishToInstagram(target)
          : await publishToTelegram(target);
      await supabaseAdmin
        .from("post_targets")
        .update({
          status: "published",
          external_id: result.externalId,
          url: result.url,
          error: null,
          published_at: new Date().toISOString(),
        })
        .eq("id", target.target_id);
      outcome.published++;
    } catch (failure) {
      outcome.failed++;
      console.error(
        `post target ${target.target_id} failed:`,
        describe(failure),
      );
      await supabaseAdmin
        .from("post_targets")
        .update({ status: "failed", error: describe(failure) })
        .eq("id", target.target_id);
    }
  }
  outcome.refreshed = await refreshTokens();
  return jsonResponse(outcome);
});
