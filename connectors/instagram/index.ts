import {
  fetchWithTimeout,
  type Connector,
  type ConnectorContext,
} from "../types.ts";

/**
 * Instagram connector: publishing to an Instagram business or creator account
 * through the Instagram API with Instagram Login (graph.instagram.com).
 * The access token comes in context.settings.access_token; the connector
 * never reads it from anywhere else.
 *
 * Publishing is two steps: create a media container from a public URL of the
 * photo or video, then publish it. Videos (reels) are processed by Instagram
 * first, so their container is polled until it is ready. A carousel is a
 * container of up to 10 item containers. Instagram limits how many posts an
 * account publishes through the API a day: read the live quota before
 * publishing rather than assuming a number.
 */

export const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
export const INSTAGRAM_API_VERSION = "v23.0";
export const MAX_CAROUSEL_ITEMS = 10;
export const MAX_CAPTION_LENGTH = 2200;

export class InstagramError extends Error {
  constructor(
    readonly step: string,
    readonly status: number,
    readonly description: string,
    /** Instagram's error code: 190 is an expired or revoked token */
    readonly code?: number,
  ) {
    super(`Instagram ${step} failed (${status}): ${description}`);
    this.name = "InstagramError";
  }
}

export const isExpiredToken = (error: unknown): boolean =>
  error instanceof InstagramError && error.code === 190;

const tokenOf = (step: string, context: ConnectorContext): string => {
  const token = context.settings?.access_token;
  if (!token || token.length < 20) {
    throw new InstagramError(step, 0, "no access token");
  }
  return token;
};

async function callInstagram<T>(
  step: string,
  path: string,
  method: "GET" | "POST",
  params: Record<string, string>,
  context: ConnectorContext,
): Promise<T> {
  const token = tokenOf(step, context);
  const query = new URLSearchParams({ ...params, access_token: token });
  const url = path.startsWith("/refresh_access_token")
    ? `${INSTAGRAM_GRAPH_URL}${path}`
    : `${INSTAGRAM_GRAPH_URL}/${INSTAGRAM_API_VERSION}${path}`;
  let response: Response;
  try {
    response =
      method === "GET"
        ? await fetchWithTimeout(context, `${url}?${query}`)
        : await fetchWithTimeout(context, url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: query.toString(),
          });
  } catch (error) {
    throw new InstagramError(
      step,
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  const answer = (await response.json().catch(() => null)) as
    (T & { error?: { message?: string; code?: number } }) | null;
  if (!response.ok || !answer || answer.error) {
    throw new InstagramError(
      step,
      response.status,
      answer?.error?.message ?? "no answer",
      answer?.error?.code,
    );
  }
  return answer;
}

export interface InstagramAccount {
  user_id: string;
  username: string;
}

/** The account the token belongs to. */
export const getMe = (context: ConnectorContext) =>
  callInstagram<InstagramAccount>(
    "me",
    "/me",
    "GET",
    { fields: "user_id,username" },
    context,
  );

/** A fresh long-lived token (60 days) for a long-lived token at least a day old. */
export const refreshToken = (context: ConnectorContext) =>
  callInstagram<{ access_token: string; expires_in: number }>(
    "refresh",
    "/refresh_access_token",
    "GET",
    { grant_type: "ig_refresh_token" },
    context,
  );

/** Posts published through the API in the last 24 hours and the allowed total. */
export const publishingQuota = async (
  userId: string,
  context: ConnectorContext,
): Promise<{ used: number; total: number | null }> => {
  const answer = await callInstagram<{
    data?: { quota_usage?: number; config?: { quota_total?: number } }[];
  }>(
    "quota",
    `/${userId}/content_publishing_limit`,
    "GET",
    { fields: "quota_usage,config" },
    context,
  );
  const row = answer.data?.[0];
  return {
    used: row?.quota_usage ?? 0,
    total: row?.config?.quota_total ?? null,
  };
};

export interface InstagramMedia {
  /** A public URL Instagram can download (JPEG photos, MP4 or MOV videos) */
  url: string;
  isVideo: boolean;
}

export type InstagramFormat = "post" | "story" | "reel";

const createContainer = async (
  userId: string,
  params: Record<string, string>,
  context: ConnectorContext,
): Promise<string> =>
  (
    await callInstagram<{ id: string }>(
      "container",
      `/${userId}/media`,
      "POST",
      params,
      context,
    )
  ).id;

const mediaParams = (item: InstagramMedia): Record<string, string> =>
  item.isVideo ? { video_url: item.url } : { image_url: item.url };

/** Waits until Instagram has processed the videos of a container. */
const waitUntilReady = async (
  containerId: string,
  context: ConnectorContext,
  wait: (ms: number) => Promise<void>,
  attempts: number,
): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { status_code } = await callInstagram<{ status_code?: string }>(
      "status",
      `/${containerId}`,
      "GET",
      { fields: "status_code" },
      context,
    );
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new InstagramError("status", 0, `media ${status_code}`);
    }
    await wait(5_000);
  }
  throw new InstagramError("status", 0, "media is still being processed");
};

const defaultWait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Publishes a post, a story or a reel; returns the id and link of the media.
 * A post with several photos or videos becomes a carousel.
 */
export const publish = async (
  {
    userId,
    format,
    caption,
    media,
  }: {
    userId: string;
    format: InstagramFormat;
    caption: string;
    media: InstagramMedia[];
  },
  context: ConnectorContext,
  { wait = defaultWait, attempts = 24 } = {},
): Promise<{ id: string; permalink: string | null }> => {
  if (media.length === 0) {
    throw new InstagramError(
      "container",
      0,
      "Instagram needs a photo or video",
    );
  }
  const text = caption.slice(0, MAX_CAPTION_LENGTH);
  const hasVideo = media.some((item) => item.isVideo);
  let containerId: string;

  if (format === "story") {
    containerId = await createContainer(
      userId,
      { ...mediaParams(media[0]), media_type: "STORIES" },
      context,
    );
  } else if (format === "reel") {
    const video = media.find((item) => item.isVideo);
    if (!video)
      throw new InstagramError("container", 0, "a reel needs a video");
    containerId = await createContainer(
      userId,
      { video_url: video.url, media_type: "REELS", caption: text },
      context,
    );
  } else if (media.length === 1) {
    containerId = await createContainer(
      userId,
      media[0].isVideo
        ? { video_url: media[0].url, media_type: "REELS", caption: text }
        : { image_url: media[0].url, caption: text },
      context,
    );
  } else {
    const children: string[] = [];
    for (const item of media.slice(0, MAX_CAROUSEL_ITEMS)) {
      children.push(
        await createContainer(
          userId,
          {
            ...mediaParams(item),
            ...(item.isVideo ? { media_type: "VIDEO" } : {}),
            is_carousel_item: "true",
          },
          context,
        ),
      );
    }
    if (hasVideo) {
      for (const child of children) {
        await waitUntilReady(child, context, wait, attempts);
      }
    }
    containerId = await createContainer(
      userId,
      { media_type: "CAROUSEL", children: children.join(","), caption: text },
      context,
    );
  }
  if (hasVideo) await waitUntilReady(containerId, context, wait, attempts);

  const { id } = await callInstagram<{ id: string }>(
    "publish",
    `/${userId}/media_publish`,
    "POST",
    { creation_id: containerId },
    context,
  );
  const permalink = await callInstagram<{ permalink?: string }>(
    "permalink",
    `/${id}`,
    "GET",
    { fields: "permalink" },
    context,
  )
    .then((answer) => answer.permalink ?? null)
    .catch(() => null);
  return { id, permalink };
};

export const instagramConnector: Connector<
  {
    userId: string;
    format: InstagramFormat;
    caption: string;
    media: InstagramMedia[];
  },
  { id: string; permalink: string | null }
> = {
  id: "instagram",
  kind: "messaging",
  call: (input, context) => publish(input, context),
};
