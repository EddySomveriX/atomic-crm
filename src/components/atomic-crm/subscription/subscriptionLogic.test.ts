import { describe, expect, it } from "vitest";

import {
  bannerKind,
  canAddMember,
  cheapestPlanWith,
  daysLeft,
} from "./subscriptionLogic";
import type { Plan, Subscription } from "./types";

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  plan: "pro",
  status: "trial",
  ends_at: null,
  features: [],
  max_members: null,
  members: 1,
  ...overrides,
});

const NOW = new Date("2026-11-22T12:00:00");

describe("daysLeft", () => {
  it("counts the days left of a trial", () => {
    const trial = subscription({ ends_at: "2026-12-22T12:00:00" });

    expect(daysLeft(trial, NOW)).toBe(30);
  });

  it("counts the last paid day as a day left", () => {
    const paid = subscription({ status: "active", ends_at: "2026-11-22" });

    expect(daysLeft(paid, NOW)).toBe(1);
  });

  it("leaves no days to a read-only business", () => {
    const unpaid = subscription({
      status: "read_only",
      ends_at: "2026-11-01",
    });

    expect(daysLeft(unpaid, NOW)).toBe(0);
  });
});

describe("bannerKind", () => {
  it("stays quiet while the end is far", () => {
    expect(
      bannerKind(subscription({ ends_at: "2026-12-22T12:00:00" }), NOW),
    ).toBeNull();
  });

  it("warns a week before the end", () => {
    expect(
      bannerKind(subscription({ ends_at: "2026-11-27T12:00:00" }), NOW),
    ).toBe("ending");
  });

  it("tells a read-only business it only reads", () => {
    expect(bannerKind(subscription({ status: "read_only" }), NOW)).toBe(
      "read_only",
    );
  });
});

describe("cheapestPlanWith", () => {
  const plans: Plan[] = [
    {
      code: "pro",
      sort: 3,
      price_minor: 129900,
      currency: "UAH",
      max_members: null,
      features: ["messengers", "weekly_report"],
    },
    {
      code: "business",
      sort: 2,
      price_minor: 69900,
      currency: "UAH",
      max_members: 5,
      features: ["messengers"],
    },
  ];

  it("suggests the least expensive plan with the feature", () => {
    expect(cheapestPlanWith(plans, "messengers")?.code).toBe("business");
    expect(cheapestPlanWith(plans, "weekly_report")?.code).toBe("pro");
  });
});

describe("canAddMember", () => {
  it("lets a plan with room take one more person", () => {
    expect(
      canAddMember(
        subscription({ status: "active", max_members: 5, members: 4 }),
      ),
    ).toBe(true);
  });

  it("stops at the member limit and in a read-only business", () => {
    expect(
      canAddMember(
        subscription({ status: "active", max_members: 1, members: 1 }),
      ),
    ).toBe(false);
    expect(canAddMember(subscription({ status: "read_only" }))).toBe(false);
  });
});
