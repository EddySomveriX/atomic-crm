import { describe, expect, it } from "vitest";

import type { InboundEvent } from "../../../../connectors/messaging.ts";
import { bodyOf, botInputOf } from "./inboundInput.ts";

const event = (overrides: Partial<InboundEvent>): InboundEvent => ({
  accountId: "17841",
  chatId: "900",
  eventId: "m1",
  senderName: "Olena",
  phone: null,
  text: "",
  ...overrides,
});

const offered = {
  reply_choices: [
    { data: "book", label: "Записатися" },
    { data: "my", label: "Мої записи" },
  ],
  bot_state: {},
};

describe("botInputOf", () => {
  it("takes a pressed button as it is", () => {
    const { input, button } = botInputOf(
      event({ text: "Cut", button: { data: "svc:3", label: "Cut" } }),
      offered,
    );
    expect(input).toEqual({ kind: "button", data: "svc:3" });
    expect(button?.label).toBe("Cut");
  });

  it("reads a typed number as the button offered under it", () => {
    expect(botInputOf(event({ text: "2" }), offered).input).toEqual({
      kind: "button",
      data: "my",
    });
  });

  it("reads the code Viber sends for a pressed button", () => {
    expect(botInputOf(event({ text: "book" }), offered).input).toEqual({
      kind: "button",
      data: "book",
    });
  });

  it("reads a typed phone number only when the dialog asked for it", () => {
    const asking = { reply_choices: [], bot_state: { step: "phone" } };
    expect(
      botInputOf(event({ text: "+380 67 123 45 67" }), asking).input,
    ).toEqual({ kind: "contact", phone: "+380671234567", name: "Olena" });
    expect(
      botInputOf(event({ text: "+380 67 123 45 67" }), offered).input,
    ).toEqual({ kind: "text", text: "+380 67 123 45 67" });
  });

  it("starts the dialog when the chat is opened", () => {
    expect(botInputOf(event({ isStart: true }), offered).input).toEqual({
      kind: "start",
    });
  });

  it("leaves other texts to a person", () => {
    expect(
      botInputOf(event({ text: "Do you work on Sunday?" }), offered),
    ).toEqual({
      input: { kind: "text", text: "Do you work on Sunday?" },
      button: null,
    });
  });
});

describe("bodyOf", () => {
  it("shows a pressed button in brackets", () => {
    expect(bodyOf(event({ text: "2" }), offered.reply_choices[1])).toBe(
      "[Мої записи]",
    );
  });

  it("marks a photo and keeps its caption", () => {
    expect(
      bodyOf(
        event({
          text: "my nails",
          attachment: {
            kind: "photo",
            url: "https://cdn/x.jpg",
            file_name: "photo.jpg",
            mime_type: "image/jpeg",
            size: null,
          },
        }),
        null,
      ),
    ).toBe("[photo]\nmy nails");
  });

  it("marks what it cannot show", () => {
    expect(bodyOf(event({ text: "" }), null)).toBe("[attachment]");
  });
});
