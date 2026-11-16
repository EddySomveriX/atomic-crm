import type { Identifier, RaRecord } from "ra-core";

export type MarketingAccountKind = "telegram_channel" | "instagram";

/** public.marketing_accounts: a Telegram channel or an Instagram account. */
export interface MarketingAccount extends RaRecord {
  kind: MarketingAccountKind;
  name: string;
  external_id: string;
  enabled: boolean;
}

export const POST_FORMATS = ["post", "story", "reel"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export type PostStatus =
  "draft" | "scheduled" | "published" | "partly" | "failed";

export interface PostMedia {
  /** Path in the post_media bucket: <business id>/<random>/<file> */
  path: string;
  mime: string;
}

/** public.posts */
export interface Post extends RaRecord {
  created_at: string;
  format: PostFormat;
  text: string;
  media: PostMedia[];
  scheduled_at: string | null;
  status: PostStatus;
  source: "manual" | "offer" | "free_slots";
  promotion_id: Identifier | null;
}

/** public.post_targets */
export interface PostTarget extends RaRecord {
  post_id: Identifier;
  account_id: Identifier;
  status: "pending" | "publishing" | "published" | "failed";
  url: string | null;
  error: string | null;
  published_at: string | null;
}

export interface PostInput {
  format: PostFormat;
  text: string;
  media: PostMedia[];
  /** null: keep it as a draft */
  scheduled_at: string | null;
  account_ids: Identifier[];
  source: Post["source"];
  promotion_id: Identifier | null;
}

/** Instagram accepts JPEG photos and MP4 or MOV videos; Telegram all of them. */
export const POST_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/quicktime",
] as const;
export const MAX_POST_MEDIA = 10;
export const MAX_POST_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_POST_TEXT = 2200;

/** Which formats an account takes: stories and reels go to Instagram only. */
export const acceptsFormat = (
  kind: MarketingAccountKind,
  format: PostFormat,
): boolean => kind === "instagram" || format === "post";

/**
 * What stops a post from being planned, as a translation key; null when it
 * can go. Instagram needs a photo or a video; a reel needs a video.
 */
export const postProblem = (
  input: Pick<PostInput, "format" | "text" | "media">,
  accounts: Pick<MarketingAccount, "kind">[],
): string | null => {
  if (accounts.length === 0) return "crm.marketing.problems.no_account";
  if (input.text.trim() === "" && input.media.length === 0) {
    return "crm.marketing.problems.empty";
  }
  if (input.text.length > MAX_POST_TEXT)
    return "crm.marketing.problems.too_long";
  const toInstagram = accounts.some((account) => account.kind === "instagram");
  if (toInstagram && input.media.length === 0) {
    return "crm.marketing.problems.instagram_media";
  }
  if (
    input.format === "reel" &&
    !input.media.some((item) => item.mime.startsWith("video/"))
  ) {
    return "crm.marketing.problems.reel_video";
  }
  return null;
};

/** Instagram usernames: letters, digits, dots and underscores, up to 30 */
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

/** "@olena.style" or a profile link typed by a person → "olena.style". */
export const instagramUsername = (text: string): string | null => {
  const cleaned = text
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
  return USERNAME.test(cleaned) ? cleaned : null;
};
