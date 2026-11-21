import { describe, expect, it } from "vitest";

import { toggleRecipient, weekdayName } from "./weeklyReport";

describe("toggleRecipient", () => {
  it("adds a member who was not chosen", () => {
    expect(toggleRecipient([1], 2)).toEqual([1, 2]);
  });

  it("removes a chosen member, whatever the id type", () => {
    expect(toggleRecipient([1, "2", 3], 2)).toEqual([1, 3]);
  });
});

describe("weekdayName", () => {
  it("names Monday as day 1 and Sunday as day 7", () => {
    expect(weekdayName(1, "uk")).toBe("понеділок");
    expect(weekdayName(7, "en")).toBe("Sunday");
  });
});
