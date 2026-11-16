import type { TranslateFunction as Translate } from "ra-core";
import { describe, expect, it } from "vitest";

import type { Promotion } from "../pricing/types";
import { freeSlotsPostText, offerPostText } from "./postTemplates";
import { acceptsFormat, instagramUsername, postProblem } from "./types";

/** Returns the key and its options, so the texts are checked without translations. */
const translate = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as Translate;

const promotion: Promotion = {
  id: 1,
  kind: "happy_hours",
  name: "Morning",
  percent: 20,
  product_ids: [],
  weekdays: [1, 2],
  time_from: "10:00:00",
  time_to: "12:00:00",
  within_hours: null,
  code: null,
  max_uses: null,
  used_count: 0,
  valid_from: null,
  valid_to: "2026-12-31",
  active: true,
};

describe("offerPostText", () => {
  it("names the offer, its hours, end date, new prices and the booking link", () => {
    const text = offerPostText({
      promotion,
      services: [
        { name: "Cut", price: 50000 },
        { name: "Free advice", price: null },
      ],
      money: (minor) => `${minor / 100}`,
      formatDate: (day) => day,
      bookingLink: "https://t.me/salon_bot",
      translate,
    });
    expect(text.split("\n")).toEqual([
      'crm.marketing.templates.offer_title {"name":"Morning","percent":20}',
      'crm.marketing.templates.happy_hours {"from":"10:00","to":"12:00"}',
      'crm.marketing.templates.until {"date":"2026-12-31"}',
      "",
      "Cut: 500 → 400",
      "",
      'crm.marketing.templates.book {"link":"https://t.me/salon_bot"}',
    ]);
  });
});

describe("freeSlotsPostText", () => {
  it("lists the free times of each service", () => {
    const text = freeSlotsPostText({
      dayLabel: "tomorrow",
      slots: [
        { service: "Cut", times: ["10:00", "12:30"] },
        { service: "Colour", times: [] },
      ],
      bookingLink: null,
      translate,
    });
    expect(text?.split("\n")).toEqual([
      'crm.marketing.templates.free_title {"day":"tomorrow"}',
      "",
      "Cut: 10:00, 12:30",
    ]);
  });

  it("has no text when the day is full", () => {
    expect(
      freeSlotsPostText({
        dayLabel: "tomorrow",
        slots: [{ service: "Cut", times: [] }],
        bookingLink: null,
        translate,
      }),
    ).toBeNull();
  });
});

describe("postProblem", () => {
  const photo = { path: "b/1/a.jpg", mime: "image/jpeg" };
  const channel = { kind: "telegram_channel" as const };
  const instagram = { kind: "instagram" as const };

  it("lets a text go to a Telegram channel", () => {
    expect(
      postProblem({ format: "post", text: "News", media: [] }, [channel]),
    ).toBeNull();
  });

  it("asks for a photo or video for Instagram", () => {
    expect(
      postProblem({ format: "post", text: "News", media: [] }, [instagram]),
    ).toBe("crm.marketing.problems.instagram_media");
  });

  it("asks for a video for a reel", () => {
    expect(
      postProblem({ format: "reel", text: "", media: [photo] }, [instagram]),
    ).toBe("crm.marketing.problems.reel_video");
  });

  it("asks where to publish", () => {
    expect(postProblem({ format: "post", text: "News", media: [] }, [])).toBe(
      "crm.marketing.problems.no_account",
    );
  });

  it("sends stories and reels to Instagram only", () => {
    expect(acceptsFormat("telegram_channel", "story")).toBe(false);
    expect(acceptsFormat("instagram", "reel")).toBe(true);
  });
});

describe("instagramUsername", () => {
  it("reads a username typed with @ or as a profile link", () => {
    expect(instagramUsername("@olena.style")).toBe("olena.style");
    expect(instagramUsername("https://www.instagram.com/olena_style/")).toBe(
      "olena_style",
    );
  });

  it("refuses names with spaces or other signs", () => {
    expect(instagramUsername("olena style")).toBeNull();
    expect(instagramUsername("олена")).toBeNull();
  });
});
