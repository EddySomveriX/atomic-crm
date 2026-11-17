import { describe, expect, it } from "vitest";

import { replyWindow } from "./replyWindow";

const now = new Date("2030-01-10T12:00:00Z");

describe("replyWindow", () => {
  it("has no limit in Telegram, Viber and the website widget", () => {
    expect(replyWindow("telegram", null, now).isOpen).toBe(true);
    expect(replyWindow("viber", null, now).isLimited).toBe(false);
  });

  it("is open for 24 hours after the client wrote in Instagram", () => {
    expect(replyWindow("instagram", "2030-01-10T07:30:00Z", now)).toEqual({
      isLimited: true,
      isOpen: true,
      hoursLeft: 19,
    });
  });

  it("closes after 24 hours in WhatsApp and Messenger", () => {
    expect(replyWindow("whatsapp", "2030-01-09T11:59:00Z", now).isOpen).toBe(
      false,
    );
    expect(replyWindow("messenger", null, now).isOpen).toBe(false);
  });
});
