import { describe, expect, it } from "vitest";

import { postToChannel } from "./index.ts";

const TOKEN = "123456789:AAH1bGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9xyz";

/** A fake Bot API that records the method and the form or JSON of each call. */
const fakeBot = () => {
  const calls: { method: string; body: FormData | Record<string, unknown> }[] =
    [];
  const fetch = (async (url: string, init?: RequestInit) => {
    const method = url.split("/").at(-1) ?? "";
    const body =
      init?.body instanceof FormData
        ? init.body
        : JSON.parse(String(init?.body ?? "{}"));
    calls.push({ method, body });
    const result =
      method === "sendMediaGroup"
        ? [{ message_id: 7 }, { message_id: 8 }]
        : { message_id: calls.length };
    return new Response(JSON.stringify({ ok: true, result }));
  }) as typeof globalThis.fetch;
  return { fetch, calls, context: { fetch, settings: { botToken: TOKEN } } };
};

const photo = (name: string) => ({
  file: new Blob(["x"], { type: "image/jpeg" }),
  fileName: name,
  isVideo: false,
});

describe("posting to a Telegram channel", () => {
  it("sends a text without media as a message", async () => {
    const { calls, context } = fakeBot();
    await postToChannel("@salon", "News", [], context);
    expect(calls.map((call) => call.method)).toEqual(["sendMessage"]);
  });

  it("sends one photo with the text as its caption", async () => {
    const { calls, context } = fakeBot();
    await postToChannel("@salon", "Spring offer", [photo("a.jpg")], context);
    expect(calls[0].method).toBe("sendPhoto");
    expect((calls[0].body as FormData).get("caption")).toBe("Spring offer");
  });

  it("sends several photos as an album and returns the first message", async () => {
    const { calls, context } = fakeBot();
    const id = await postToChannel(
      "@salon",
      "Album",
      [photo("a.jpg"), photo("b.jpg")],
      context,
    );
    expect(id).toBe(7);
    const media = JSON.parse(
      String((calls[0].body as FormData).get("media")),
    ) as { caption?: string }[];
    expect(media).toHaveLength(2);
    expect(media[0].caption).toBe("Album");
  });

  it("sends a text too long for a caption as its own message", async () => {
    const { calls, context } = fakeBot();
    await postToChannel("@salon", "x".repeat(1500), [photo("a.jpg")], context);
    expect(calls.map((call) => call.method)).toEqual([
      "sendPhoto",
      "sendMessage",
    ]);
    expect((calls[0].body as FormData).get("caption")).toBeNull();
  });
});
