import { describe, expect, it } from "vitest";

import {
  InstagramError,
  getMe,
  isExpiredToken,
  publish,
  publishingQuota,
} from "./index.ts";

const TOKEN = "IGAAexampleexampleexampleexample";

/** A fake Instagram: answers by the path of each call, records the calls. */
const fakeInstagram = (
  answers: Record<string, unknown[] | unknown>,
  status = 200,
) => {
  const calls: { method: string; path: string; params: URLSearchParams }[] = [];
  const counters: Record<string, number> = {};
  const fetch = (async (url: string, init?: RequestInit) => {
    const parsed = new URL(url);
    const method = init?.method ?? "GET";
    const params =
      method === "GET"
        ? parsed.searchParams
        : new URLSearchParams(String(init?.body ?? ""));
    const path = parsed.pathname.replace(/^\/v[\d.]+/, "");
    calls.push({ method, path, params });
    const key = `${method} ${path}`;
    const answer = answers[key];
    const index = counters[key] ?? 0;
    counters[key] = index + 1;
    const body = Array.isArray(answer)
      ? answer[Math.min(index, answer.length - 1)]
      : answer;
    return new Response(JSON.stringify(body ?? {}), { status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
};

const context = (fetch: typeof globalThis.fetch) => ({
  fetch,
  settings: { access_token: TOKEN },
});
const noWait = { wait: async () => {}, attempts: 3 };

describe("instagram connector", () => {
  it("tells whose account a token opens", async () => {
    const { fetch, calls } = fakeInstagram({
      "GET /me": { user_id: "17841", username: "salon" },
    });
    expect(await getMe(context(fetch))).toEqual({
      user_id: "17841",
      username: "salon",
    });
    expect(calls[0].params.get("access_token")).toBe(TOKEN);
  });

  it("publishes one photo with its caption and returns the link", async () => {
    const { fetch, calls } = fakeInstagram({
      "POST /17841/media": { id: "c1" },
      "POST /17841/media_publish": { id: "m1" },
      "GET /m1": { permalink: "https://www.instagram.com/p/abc/" },
    });
    const result = await publish(
      {
        userId: "17841",
        format: "post",
        caption: "Spring offer",
        media: [{ url: "https://files.example/a.jpg", isVideo: false }],
      },
      context(fetch),
      noWait,
    );
    expect(result).toEqual({
      id: "m1",
      permalink: "https://www.instagram.com/p/abc/",
    });
    expect(calls[0].params.get("image_url")).toBe(
      "https://files.example/a.jpg",
    );
    expect(calls[0].params.get("caption")).toBe("Spring offer");
    expect(calls[1].params.get("creation_id")).toBe("c1");
  });

  it("makes a carousel of several photos", async () => {
    const { fetch, calls } = fakeInstagram({
      "POST /17841/media": [{ id: "i1" }, { id: "i2" }, { id: "car" }],
      "POST /17841/media_publish": { id: "m2" },
      "GET /m2": {},
    });
    await publish(
      {
        userId: "17841",
        format: "post",
        caption: "Two photos",
        media: [
          { url: "https://files.example/a.jpg", isVideo: false },
          { url: "https://files.example/b.jpg", isVideo: false },
        ],
      },
      context(fetch),
      noWait,
    );
    const carousel = calls[2].params;
    expect(carousel.get("media_type")).toBe("CAROUSEL");
    expect(carousel.get("children")).toBe("i1,i2");
    expect(calls[0].params.get("is_carousel_item")).toBe("true");
  });

  it("waits until a reel is processed before publishing it", async () => {
    const { fetch, calls } = fakeInstagram({
      "POST /17841/media": { id: "r1" },
      "GET /r1": [{ status_code: "IN_PROGRESS" }, { status_code: "FINISHED" }],
      "POST /17841/media_publish": { id: "m3" },
      "GET /m3": {},
    });
    await publish(
      {
        userId: "17841",
        format: "reel",
        caption: "Reel",
        media: [{ url: "https://files.example/v.mp4", isVideo: true }],
      },
      context(fetch),
      noWait,
    );
    expect(calls[0].params.get("media_type")).toBe("REELS");
    expect(
      calls.filter((call) => call.path === "/r1").length,
    ).toBeGreaterThanOrEqual(2);
    expect(calls.at(-2)?.path).toBe("/17841/media_publish");
  });

  it("refuses a post without a photo or video", async () => {
    const { fetch } = fakeInstagram({});
    await expect(
      publish(
        { userId: "17841", format: "post", caption: "Text only", media: [] },
        context(fetch),
        noWait,
      ),
    ).rejects.toBeInstanceOf(InstagramError);
  });

  it("recognizes an expired token", async () => {
    const { fetch } = fakeInstagram(
      { "GET /me": { error: { message: "Session has expired", code: 190 } } },
      400,
    );
    const failure = await getMe(context(fetch)).catch((error) => error);
    expect(isExpiredToken(failure)).toBe(true);
  });

  it("reads the live publishing quota", async () => {
    const { fetch } = fakeInstagram({
      "GET /17841/content_publishing_limit": {
        data: [{ quota_usage: 3, config: { quota_total: 100 } }],
      },
    });
    expect(await publishingQuota("17841", context(fetch))).toEqual({
      used: 3,
      total: 100,
    });
  });
});
