import { describe, expect, it } from "vitest";

import {
  TelegramError,
  getMe,
  isBotToken,
  sendMessage,
  type TelegramUser,
} from "./index.ts";

const TOKEN = "123456789:AAH1bGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9xyz";

const fakeFetch = (answer: unknown, status = 200) => {
  const calls: { url: string; body: unknown }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify(answer), { status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
};

describe("telegram connector", () => {
  it("recognizes a token from BotFather", () => {
    expect(isBotToken(TOKEN)).toBe(true);
    expect(isBotToken("123:short")).toBe(false);
    expect(isBotToken("not a token at all, really not")).toBe(false);
  });

  it("checks a token by asking who the bot is", async () => {
    const bot: TelegramUser = {
      id: 1,
      is_bot: true,
      first_name: "Salon",
      username: "salon_bot",
    };
    const { fetch, calls } = fakeFetch({ ok: true, result: bot });

    const result = await getMe({ fetch, settings: { botToken: TOKEN } });

    expect(result.username).toBe("salon_bot");
    expect(calls[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/getMe`);
  });

  it("sends a message with buttons to a chat", async () => {
    const { fetch, calls } = fakeFetch({
      ok: true,
      result: { message_id: 7, date: 0, chat: { id: 42, type: "private" } },
    });

    await sendMessage(
      42,
      "Choose a service",
      { inline_keyboard: [[{ text: "Haircut", callback_data: "svc:1" }]] },
      { fetch, settings: { botToken: TOKEN } },
    );

    expect(calls[0].body).toEqual({
      chat_id: 42,
      text: "Choose a service",
      reply_markup: {
        inline_keyboard: [[{ text: "Haircut", callback_data: "svc:1" }]],
      },
    });
  });

  it("reports a refusal with Telegram's reason and never the token", async () => {
    const { fetch } = fakeFetch(
      { ok: false, error_code: 401, description: "Unauthorized" },
      401,
    );

    const error = await getMe({ fetch, settings: { botToken: TOKEN } }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TelegramError);
    expect((error as Error).message).toBe(
      "Telegram getMe failed (401): Unauthorized",
    );
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it("does not call Telegram without a valid token", async () => {
    const { fetch, calls } = fakeFetch({ ok: true, result: true });

    await expect(getMe({ fetch, settings: {} })).rejects.toThrow(
      "no valid bot token",
    );
    expect(calls).toHaveLength(0);
  });
});
