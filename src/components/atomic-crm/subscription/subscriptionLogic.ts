import type { Plan, PlanFeature, Subscription } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The banner shows the end of a trial or a paid period this close. */
export const ENDING_SOON_DAYS = 7;

/**
 * Whole days until the trial or the paid period ends, counting the current
 * one (a paid period lasts through its last day). 0: it has ended.
 */
export const daysLeft = (subscription: Subscription, now: Date): number => {
  if (!subscription.ends_at || subscription.status === "read_only") return 0;
  const end =
    subscription.status === "active"
      ? // the last paid day is inclusive: it ends at the start of the next one
        new Date(`${subscription.ends_at}T00:00:00`).getTime() + DAY_MS
      : new Date(subscription.ends_at).getTime();
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS));
};

export type BannerKind = "read_only" | "ending" | null;

/** What the top banner says: nothing, "ends soon" or "read-only". */
export const bannerKind = (
  subscription: Subscription | null | undefined,
  now: Date,
): BannerKind => {
  if (!subscription) return null;
  if (subscription.status === "read_only") return "read_only";
  return daysLeft(subscription, now) <= ENDING_SOON_DAYS ? "ending" : null;
};

export const hasPlanFeature = (
  subscription: Subscription | null | undefined,
  feature: PlanFeature,
): boolean => subscription?.features.includes(feature) ?? false;

/** The least expensive plan that includes a feature, to suggest an upgrade. */
export const cheapestPlanWith = (
  plans: Plan[],
  feature: PlanFeature,
): Plan | undefined =>
  [...plans]
    .sort((a, b) => a.sort - b.sort)
    .find((plan) => plan.features.includes(feature));

/** Whether one more person fits the member limit of the plan. */
export const canAddMember = (
  subscription: Subscription | null | undefined,
): boolean => {
  if (!subscription || subscription.status === "read_only") return false;
  return (
    subscription.max_members == null ||
    subscription.members < subscription.max_members
  );
};
