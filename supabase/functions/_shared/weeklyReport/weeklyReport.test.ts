import { describe, expect, it } from "vitest";

import { buildReport, change, type ReportAnalytics } from "./reportText.ts";
import { duePeriod, lastSevenDays, startOfDay } from "./schedule.ts";

const KYIV = "Europe/Kyiv";
// Monday 2030-01-07; Kyiv is UTC+2 in winter
const mondayAt = (hour: number) => new Date(Date.UTC(2030, 0, 7, hour - 2, 30));

const analytics = (
  overrides: Partial<ReportAnalytics["kpis"]> = {},
  rest: Partial<ReportAnalytics> = {},
): ReportAnalytics => ({
  currency: "UAH",
  kpis: {
    revenue: 1_240_000,
    completed: 23,
    no_show: 2,
    new_clients: 5,
    waiting_now: 0,
    ...overrides,
  },
  top_services: [{ name: "Стрижка", bookings: 12 }],
  specialists: [{ name: "Ірина", booked_minutes: 1080, working_minutes: 2400 }],
  dormant_clients: [],
  stock: { out_of_stock: 0 },
  ...rest,
});

describe("startOfDay", () => {
  it("finds midnight of the business time zone", () => {
    expect(startOfDay("2030-01-07", KYIV).toISOString()).toBe(
      "2030-01-06T22:00:00.000Z",
    );
    expect(startOfDay("2030-07-01", KYIV).toISOString()).toBe(
      "2030-06-30T21:00:00.000Z",
    );
  });
});

describe("duePeriod", () => {
  const monday9 = { weekday: 1, hour: 9, last_sent_week: null };

  it("is not due before the chosen hour", () => {
    expect(duePeriod(mondayAt(8), monday9, KYIV)).toEqual(
      // last week's moment is over a day ago
      null,
    );
  });

  it("covers the week before a morning report", () => {
    expect(duePeriod(mondayAt(9), monday9, KYIV)).toEqual({
      firstDay: "2029-12-31",
      endDay: "2030-01-07",
    });
  });

  it("is sent once a week", () => {
    expect(
      duePeriod(
        mondayAt(10),
        { ...monday9, last_sent_week: "2029-12-31" },
        KYIV,
      ),
    ).toBeNull();
  });

  it("includes the send day in an evening report", () => {
    const sunday20 = { weekday: 7, hour: 20, last_sent_week: null };
    // Sunday 2030-01-13, 20:30 in Kyiv
    const now = new Date(Date.UTC(2030, 0, 13, 18, 30));
    expect(duePeriod(now, sunday20, KYIV)).toEqual({
      firstDay: "2030-01-07",
      endDay: "2030-01-14",
    });
  });

  it("skips a report over a day late", () => {
    const now = new Date(Date.UTC(2030, 0, 9, 10));
    expect(duePeriod(now, monday9, KYIV)).toBeNull();
  });
});

describe("lastSevenDays", () => {
  it("ends with today", () => {
    expect(lastSevenDays(mondayAt(12), KYIV)).toEqual({
      firstDay: "2030-01-01",
      endDay: "2030-01-08",
    });
  });
});

describe("change", () => {
  it("shows the growth against the week before", () => {
    expect(change(115, 100)).toBe(" (+15%)");
    expect(change(92, 100)).toBe(" (−8%)");
    expect(change(100, 0)).toBe("");
  });
});

describe("buildReport", () => {
  const period = { firstDay: "2029-12-31", endDay: "2030-01-07" };

  it("lists money, visits, specialists and services", () => {
    const report = buildReport({
      businessName: "Салон",
      language: "uk",
      period,
      current: analytics(),
      previous: analytics({ revenue: 1_000_000, completed: 20 }),
      upcoming: null,
    });
    expect(report).toContain("Звіт за тиждень");
    expect(report).toMatch(/Виручка: 12\s?400\s₴ \(\+24%\)/);
    expect(report).toContain("Візити: 23 (+15%)");
    expect(report).toContain("Ірина: 18 год, 45%");
    expect(report).toContain("Стрижка: 12");
    expect(report).not.toContain("Що зробити");
  });

  it("suggests up to three things to do, chats first", () => {
    const report = buildReport({
      businessName: "Salon",
      language: "en",
      period,
      current: analytics(
        { waiting_now: 2 },
        { stock: { out_of_stock: 3 }, dormant_clients: Array(10).fill({}) },
      ),
      previous: null,
      upcoming: analytics(
        {},
        {
          specialists: [
            { name: "Iryna", booked_minutes: 60, working_minutes: 600 },
          ],
        },
      ),
    });
    const todo = report.split("What to do:\n")[1].split("\n");
    expect(todo).toHaveLength(3);
    expect(todo[0]).toContain("Chats waiting for a reply: 2");
    expect(todo[1]).toContain("About 9 h are free next week");
    expect(todo[2]).toContain("Out of stock items: 3");
  });

  it("points to the setup after a week without visits", () => {
    const report = buildReport({
      businessName: "Salon",
      language: "en",
      period,
      current: analytics(
        { revenue: 0, completed: 0 },
        { top_services: [], specialists: [] },
      ),
      previous: null,
      upcoming: null,
    });
    expect(report).toContain("No bookings this week");
  });
});
