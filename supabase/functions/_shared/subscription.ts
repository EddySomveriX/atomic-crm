import { supabaseAdmin } from "./supabaseAdmin.ts";

/** Features a plan turns on (public.plans.features). */
export type PlanFeature =
  | "messengers"
  | "automations"
  | "marketing"
  | "booking_page"
  | "weekly_report"
  | "costing"
  | "business_map"
  | "ai";

/**
 * Whether the plan of a business includes a feature right now (a trial
 * includes all; a read-only business none). Fails closed: when the check
 * itself fails, the feature is treated as off and the cause is logged.
 */
export async function hasFeature(
  businessId: string,
  feature: PlanFeature,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("business_has_feature", {
    p_business_id: businessId,
    p_feature: feature,
  });
  if (error) {
    console.error("plan check failed:", businessId, feature, error);
    return false;
  }
  return data === true;
}
