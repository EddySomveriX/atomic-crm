import { describe, expect, it } from "vitest";

import { periodDays } from "./period";
import { parsePercent } from "./types";

describe("periodDays", () => {
  it("runs this month from its first day to today", () => {
    expect(periodDays("month", "2026-11-16")).toEqual({
      from: "2026-11-01",
      to: "2026-11-16",
    });
  });

  it("takes the whole last month, across a year", () => {
    expect(periodDays("last_month", "2026-01-10")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("starts the week on Monday", () => {
    // 2026-11-16 is a Monday, 2026-11-19 a Thursday
    expect(periodDays("week", "2026-11-19")).toEqual({
      from: "2026-11-16",
      to: "2026-11-19",
    });
  });
});

describe("parsePercent", () => {
  it("reads whole and decimal percents", () => {
    expect(parsePercent("40")).toBe(40);
    expect(parsePercent("37,5")).toBe(37.5);
  });

  it("refuses what is not a percent", () => {
    expect(parsePercent("120")).toBeNull();
    expect(parsePercent("-5")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
  });
});
