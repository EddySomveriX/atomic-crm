import { describe, expect, it } from "vitest";

import { NAV_SECTIONS } from "../modules/modules";
import { splitPinned, togglePinned } from "./pinnedSections";

const byKey = (...keys: string[]) =>
  keys.map((key) => NAV_SECTIONS.find((section) => section.key === key)!);
const keysOf = (sections: { key: string }[]) =>
  sections.map((section) => section.key);

describe("splitPinned", () => {
  const sections = byKey("chats", "booking", "pricing", "analytics");

  it("puts the first sections on the bar until the person chooses", () => {
    const { pinned, more } = splitPinned(sections, null);
    expect(keysOf(pinned)).toEqual(["chats", "booking"]);
    expect(keysOf(more)).toEqual(["pricing", "analytics"]);
  });

  it("puts the chosen sections on the bar, the rest in More", () => {
    const { pinned, more } = splitPinned(sections, ["analytics", "pricing"]);
    expect(keysOf(pinned)).toEqual(["analytics", "pricing"]);
    expect(keysOf(more)).toEqual(["chats", "booking"]);
  });

  it("fills the bar when a chosen section was turned off by the business", () => {
    const { pinned } = splitPinned(sections, ["stock", "pricing"]);
    expect(keysOf(pinned)).toEqual(["pricing", "chats"]);
  });
});

describe("togglePinned", () => {
  it("pins, unpins and replaces the oldest of two", () => {
    expect(togglePinned([], "chats")).toEqual(["chats"]);
    expect(togglePinned(["chats", "booking"], "chats")).toEqual(["booking"]);
    expect(togglePinned(["chats", "booking"], "pricing")).toEqual([
      "booking",
      "pricing",
    ]);
  });
});
