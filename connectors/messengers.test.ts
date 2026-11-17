import { describe, expect, it } from "vitest";

import {
  hmacSha256Hex,
  matchChoice,
  renderReply,
  typedPhone,
  type Choice,
} from "./messaging.ts";
import * as meta from "./meta/index.ts";
import * as viber from "./viber/index.ts";

const TOKEN = "EAAexampleexampleexampleexample";

/** Records the calls and answers each with the same body. */
const fakeFetch = (answer: unknown, status = 200) => {
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(answer), { status });
  }) as typeof globalThis.fetch;
  return { calls, context: { fetch, settings: { access_token: TOKEN } } };
};

const choices = (count: number): Choice[] =>
  Array.from({ length: count }, (_, index) => ({
    data: `svc:${index + 1}`,
    label: `Service ${index + 1}`,
  }));

describe("fitting bot buttons to a messenger", () => {
  it("sends a few buttons natively and remembers them", () => {
    const reply = renderReply("instagram", "Choose", choices(3));
    expect(reply.buttons).toHaveLength(3);
    expect(reply.text).toBe("Choose");
    expect(reply.choices).toHaveLength(3);
  });

  it("shortens titles to what the messenger shows", () => {
    const reply = renderReply("messenger", "Choose", [
      { data: "svc:1", label: "Colouring of long hair with care" },
    ]);
    expect(reply.buttons?.[0].label).toHaveLength(20);
    expect(reply.choices[0].label).toBe("Colouring of long hair with care");
  });

  it("turns too many buttons into a numbered list", () => {
    const reply = renderReply("whatsapp", "Choose a time", choices(12));
    expect(reply.buttons).toBeNull();
    expect(reply.text).toContain("\n\n1. Service 1\n2. Service 2");
    expect(reply.text).toContain("12. Service 12");
  });

  it("reads a typed number, a code or a label as a pressed button", () => {
    const list = choices(12);
    expect(matchChoice("2", list)?.data).toBe("svc:2");
    expect(matchChoice(" 12. ", list)?.data).toBe("svc:12");
    expect(matchChoice("svc:5", list)?.data).toBe("svc:5");
    expect(matchChoice("service 7", list)?.data).toBe("svc:7");
    expect(matchChoice("13", list)).toBeNull();
    expect(matchChoice("hello", list)).toBeNull();
  });

  it("reads a typed phone number", () => {
    expect(typedPhone("+380 (67) 123-45-67")).toBe("+380671234567");
    expect(typedPhone("call me tomorrow")).toBeNull();
    expect(typedPhone("12")).toBeNull();
  });
});

describe("meta connector", () => {
  it("trusts a delivery only with the app's signature", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const signature = `sha256=${await hmacSha256Hex("app-secret", body)}`;
    expect(await meta.verifySignature(body, signature, "app-secret")).toBe(
      true,
    );
    expect(
      await meta.verifySignature(`${body} `, signature, "app-secret"),
    ).toBe(false);
    expect(await meta.verifySignature(body, signature, "other")).toBe(false);
    expect(await meta.verifySignature(body, null, "app-secret")).toBe(false);
  });

  it("reads an Instagram message and skips the business's own echo", () => {
    const events = meta.parseWebhook("instagram", {
      object: "instagram",
      entry: [
        {
          id: "17841",
          messaging: [
            {
              sender: { id: "900" },
              recipient: { id: "17841" },
              message: { mid: "m1", text: "Hello" },
            },
            {
              sender: { id: "17841" },
              recipient: { id: "900" },
              message: { mid: "m2", text: "Hi", is_echo: true },
            },
          ],
        },
      ],
    });
    expect(events).toEqual([
      {
        accountId: "17841",
        chatId: "900",
        eventId: "m1",
        senderName: null,
        phone: null,
        text: "Hello",
        attachment: undefined,
      },
    ]);
  });

  it("reads a Messenger quick reply as a button and a photo as an attachment", () => {
    const events = meta.parseWebhook("messenger", {
      object: "page",
      entry: [
        {
          id: "555",
          messaging: [
            {
              sender: { id: "42" },
              message: {
                mid: "m3",
                text: "Book",
                quick_reply: { payload: "book" },
              },
            },
            {
              sender: { id: "42" },
              message: {
                mid: "m4",
                attachments: [
                  { type: "image", payload: { url: "https://cdn/x.jpg" } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events[0].button).toEqual({ data: "book", label: "Book" });
    expect(events[1].attachment?.kind).toBe("photo");
    expect(events[1].attachment?.url).toBe("https://cdn/x.jpg");
  });

  it("reads WhatsApp texts, list replies and documents with the client's number", () => {
    const events = meta.parseWebhook("whatsapp", {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1066" },
                contacts: [
                  { wa_id: "380671234567", profile: { name: "Olena" } },
                ],
                messages: [
                  {
                    from: "380671234567",
                    id: "wamid.1",
                    type: "text",
                    text: { body: "Hi" },
                  },
                  {
                    from: "380671234567",
                    id: "wamid.2",
                    type: "interactive",
                    interactive: { list_reply: { id: "svc:3", title: "Cut" } },
                  },
                  {
                    from: "380671234567",
                    id: "wamid.3",
                    type: "document",
                    document: { id: "media9", filename: "bill.pdf" },
                  },
                ],
              },
            },
            { field: "statuses", value: {} },
          ],
        },
      ],
    });
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      accountId: "1066",
      chatId: "380671234567",
      phone: "+380671234567",
      senderName: "Olena",
      text: "Hi",
    });
    expect(events[1].button).toEqual({ data: "svc:3", label: "Cut" });
    expect(events[2].attachment).toMatchObject({
      kind: "document",
      media_id: "media9",
      file_name: "bill.pdf",
    });
  });

  it("ignores a delivery of another product", () => {
    expect(
      meta.parseWebhook("instagram", { object: "page", entry: [] }),
    ).toEqual([]);
  });

  it("sends an Instagram text with quick replies", async () => {
    const { calls, context } = fakeFetch({ message_id: "out1" });
    const id = await meta.sendText(
      {
        kind: "instagram",
        accountId: "17841",
        chatId: "900",
        text: "Choose",
        buttons: [{ data: "book", label: "Book" }],
      },
      context,
    );
    expect(id).toBe("out1");
    expect(calls[0].url).toBe(
      "https://graph.instagram.com/v23.0/17841/messages",
    );
    expect(calls[0].headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].body).toEqual({
      recipient: { id: "900" },
      message: {
        text: "Choose",
        quick_replies: [
          { content_type: "text", title: "Book", payload: "book" },
        ],
      },
    });
  });

  it("sends up to three WhatsApp buttons and a list for more", async () => {
    const few = fakeFetch({ messages: [{ id: "wamid.out" }] });
    await meta.sendText(
      {
        kind: "whatsapp",
        accountId: "1066",
        chatId: "380671234567",
        text: "Confirm?",
        buttons: choices(2),
      },
      few.context,
    );
    const interactive = (few.calls[0].body as { interactive: { type: string } })
      .interactive;
    expect(interactive.type).toBe("button");

    const many = fakeFetch({ messages: [{ id: "wamid.out" }] });
    await meta.sendText(
      {
        kind: "whatsapp",
        accountId: "1066",
        chatId: "380671234567",
        text: "Choose",
        buttons: choices(6),
      },
      many.context,
    );
    expect(
      (many.calls[0].body as { interactive: { type: string } }).interactive
        .type,
    ).toBe("list");
  });

  it("reports a refusal without the token", async () => {
    const { context } = fakeFetch(
      { error: { message: "Session has expired", code: 190 } },
      400,
    );
    const failure = await meta
      .sendText(
        { kind: "messenger", accountId: "555", chatId: "42", text: "Hi" },
        context,
      )
      .catch((error) => error);
    expect(failure).toBeInstanceOf(meta.MetaError);
    expect(failure.code).toBe(190);
    expect(String(failure.message)).not.toContain(TOKEN);
  });
});

describe("viber connector", () => {
  it("trusts a delivery only with the bot's signature", async () => {
    const body = JSON.stringify({ event: "message" });
    const signature = await hmacSha256Hex(TOKEN, body);
    expect(await viber.verifySignature(body, signature, TOKEN)).toBe(true);
    expect(await viber.verifySignature(body, signature, "other-token")).toBe(
      false,
    );
  });

  it("reads a message and the first opening of the chat", () => {
    expect(
      viber.parseWebhook({
        event: "message",
        message_token: 4912661846655238000,
        sender: { id: "u1", name: "Olena", language: "uk" },
        message: { type: "text", text: "svc:2" },
      })[0],
    ).toMatchObject({ chatId: "u1", senderName: "Olena", text: "svc:2" });
    expect(
      viber.parseWebhook({
        event: "conversation_started",
        message_token: 77,
        user: { id: "u2", name: "Ivan" },
      })[0],
    ).toMatchObject({ chatId: "u2", isStart: true });
    expect(viber.parseWebhook({ event: "delivered" })).toEqual([]);
  });

  it("sends a text with a keyboard of reply buttons", async () => {
    const { calls, context } = fakeFetch({ status: 0, message_token: 5 });
    const id = await viber.sendText(
      {
        chatId: "u1",
        text: "Choose",
        senderName: "Salon",
        buttons: [{ data: "book", label: "Book" }],
      },
      context,
    );
    expect(id).toBe("5");
    expect(calls[0].headers.get("X-Viber-Auth-Token")).toBe(TOKEN);
    expect(calls[0].body).toMatchObject({
      receiver: "u1",
      text: "Choose",
      sender: { name: "Salon" },
      keyboard: { Buttons: [{ ActionType: "reply", ActionBody: "book" }] },
    });
  });

  it("treats Viber's own status as a failure", async () => {
    const { context } = fakeFetch({
      status: 6,
      status_message: "notSubscribed",
    });
    await expect(
      viber.sendText(
        { chatId: "u1", text: "Hi", senderName: "Salon" },
        context,
      ),
    ).rejects.toBeInstanceOf(viber.ViberError);
  });
});
