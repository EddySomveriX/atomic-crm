import { describe, expect, it } from "vitest";

import type { Analytics } from "../analytics/types";
import {
  initials,
  isBusyNow,
  keepBest,
  levelOf,
  levelProgress,
  pointsOf,
  tokens,
  zonesNeedingAttention,
} from "./boardLogic";

const analytics = (overrides: Partial<Analytics> = {}): Analytics =>
  ({
    kpis: { clients_total: 12, waiting_now: 0 },
    bookings_by_month: [
      { month: "2030-01", completed: 5, booked: 0, no_show: 0, cancelled: 0 },
      { month: "2030-02", completed: 3, booked: 1, no_show: 0, cancelled: 0 },
    ],
    stock: { products: 4, in_stock: 4, out_of_stock: 0, value: 0 },
    dormant_clients: [],
    ...overrides,
  }) as unknown as Analytics;

describe("level of the business", () => {
  it("counts every client and every completed visit", () => {
    expect(pointsOf(analytics())).toBe(20);
  });

  it("starts at level 1 and grows with the points", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(10)).toBe(2);
    expect(levelOf(45)).toBe(3);
  });

  it("shows how far the next level is", () => {
    expect(levelProgress(45)).toBe(0.5);
    expect(levelProgress(100_000)).toBe(1);
  });

  it("never goes back when the points drop", () => {
    expect(keepBest(50, 40)).toBe(50);
    expect(keepBest(undefined, 40)).toBe(40);
  });
});

describe("tokens on the board", () => {
  it("puts what does not fit into +N", () => {
    expect(tokens(11)).toEqual({ shown: 8, more: 3 });
    expect(tokens(2)).toEqual({ shown: 2, more: 0 });
  });

  it("names people by their initials", () => {
    expect(initials("Олена Тестова")).toBe("ОТ");
    expect(initials("  ")).toBe("?");
  });

  it("knows who has a client right now", () => {
    const bookings = [
      {
        sales_id: 7,
        starts_at: "2030-01-07T10:00:00Z",
        ends_at: "2030-01-07T11:00:00Z",
      },
    ];
    expect(isBusyNow(bookings, 7, new Date("2030-01-07T10:30:00Z"))).toBe(true);
    expect(isBusyNow(bookings, 7, new Date("2030-01-07T11:00:00Z"))).toBe(
      false,
    );
    expect(isBusyNow(bookings, 8, new Date("2030-01-07T10:30:00Z"))).toBe(
      false,
    );
  });
});

describe("zones needing attention", () => {
  it("marks waiting chats, empty stock and clients who stopped coming", () => {
    expect(zonesNeedingAttention(analytics())).toEqual([]);
    expect(
      zonesNeedingAttention(
        analytics({
          kpis: { clients_total: 1, waiting_now: 2 },
          stock: { products: 1, in_stock: 0, out_of_stock: 1, value: 0 },
          dormant_clients: [
            { id: 1, name: "Ann", visits: 3, last_day: "2029-10-01" },
          ],
        } as unknown as Partial<Analytics>),
      ),
    ).toEqual(["entrance", "stock", "return"]);
  });
});
