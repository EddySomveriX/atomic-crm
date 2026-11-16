import { HttpError, type Identifier } from "ra-core";

import { safeFileName } from "../../documents/documentFiles";
import type { PostInput, PostMedia } from "../../marketing/types";
import { getCurrentBusinessId } from "./authProvider";
import { invoke } from "./channelMethods";
import { getSupabaseClient } from "./supabase";

const POST_MEDIA_BUCKET = "post_media";
const PREVIEW_SECONDS = 60 * 60;

const fail = (error: { message?: string }) => {
  throw new HttpError(error.message ?? "failed", 400, error);
};

const randomFolder = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/** Marketing: accounts, media and planned posts. */
export const marketingMethods = {
  /** Connects a Telegram channel or an Instagram account through the server. */
  connectMarketingAccount(
    input:
      | { kind: "telegram_channel"; channel: string }
      | { kind: "instagram"; access_token: string },
  ): Promise<{ name: string }> {
    return invoke<{ name: string }>("marketing_connect", "POST", input);
  },

  /** Stores a photo or video of a post in the folder of the business. */
  async uploadPostMedia(file: File): Promise<PostMedia> {
    const path = `${await getCurrentBusinessId()}/${randomFolder()}/${safeFileName(file.name)}`;
    const { error } = await getSupabaseClient()
      .storage.from(POST_MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (error) fail(error);
    return { path, mime: file.type };
  },

  /** A link to look at a photo or video of a post for an hour. */
  async postMediaUrl(path: string): Promise<string> {
    const { data, error } = await getSupabaseClient()
      .storage.from(POST_MEDIA_BUCKET)
      .createSignedUrl(path, PREVIEW_SECONDS);
    if (error || !data) fail(error ?? {});
    return data!.signedUrl;
  },

  /**
   * Saves a post and the accounts it goes to; a post with a time is
   * scheduled, without one it stays a draft. Returns the post id.
   */
  async savePost(input: PostInput, id?: Identifier): Promise<Identifier> {
    const supabase = getSupabaseClient();
    const row = {
      format: input.format,
      text: input.text,
      media: input.media,
      scheduled_at: input.scheduled_at,
      status: input.scheduled_at ? "scheduled" : "draft",
      source: input.source,
      promotion_id: input.promotion_id,
    };
    const saved =
      id == null
        ? await supabase.from("posts").insert(row).select("id").single()
        : await supabase
            .from("posts")
            .update(row)
            .eq("id", id)
            .select("id")
            .single();
    if (saved.error) fail(saved.error);
    const postId = saved.data!.id as Identifier;

    const { data: existing, error } = await supabase
      .from("post_targets")
      .select("id, account_id, status")
      .eq("post_id", postId);
    if (error) fail(error);
    const wanted = new Set(input.account_ids.map(String));
    const dropped = (existing ?? []).filter(
      (target) =>
        !wanted.has(String(target.account_id)) && target.status === "pending",
    );
    if (dropped.length) {
      const removed = await supabase
        .from("post_targets")
        .delete()
        .in(
          "id",
          dropped.map((target) => target.id),
        );
      if (removed.error) fail(removed.error);
    }
    const have = new Set((existing ?? []).map((t) => String(t.account_id)));
    const added = input.account_ids.filter(
      (accountId) => !have.has(String(accountId)),
    );
    if (added.length) {
      const inserted = await supabase.from("post_targets").insert(
        added.map((accountId) => ({
          post_id: postId,
          account_id: accountId,
        })),
      );
      if (inserted.error) fail(inserted.error);
    }
    return postId;
  },

  /** Publishes again what failed, at the next run. */
  async retryPost(id: Identifier): Promise<void> {
    const { error } = await getSupabaseClient().rpc("retry_post", {
      p_post_id: id,
    });
    if (error) fail(error);
  },

  /** Free start times ("10:00") of services on a day, in the business time zone. */
  async getFreeSlots(
    productIds: Identifier[],
    day: string,
    timeZone: string,
  ): Promise<{ product_id: Identifier; times: string[] }[]> {
    const businessId = await getCurrentBusinessId();
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
    const result = [];
    for (const productId of productIds) {
      const { data, error } = await getSupabaseClient().rpc("free_slots", {
        p_business_id: businessId,
        p_product_id: productId,
        p_day: day,
      });
      if (error) fail(error);
      const times = [
        ...new Set(
          ((data ?? []) as { starts_at: string }[]).map((slot) =>
            format.format(new Date(slot.starts_at)),
          ),
        ),
      ].sort();
      result.push({ product_id: productId, times });
    }
    return result;
  },
};
