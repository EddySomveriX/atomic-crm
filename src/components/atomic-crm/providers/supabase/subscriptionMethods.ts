import { HttpError } from "ra-core";

import type {
  BusinessExport,
  Plan,
  PlanCode,
  PlatformBusiness,
  Subscription,
  SubscriptionChange,
} from "../../subscription/types";
import { getSupabaseClient } from "./supabase";

const fail = (message: string, error: { message?: string; code?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/** Plans, the subscription of the current business, export, platform admin. */
export const subscriptionMethods = {
  async getSubscription(): Promise<Subscription | null> {
    const { data, error } = await getSupabaseClient().rpc(
      "current_subscription",
    );
    if (error) fail("Failed to load the plan", error);
    return (data as Subscription | null) ?? null;
  },

  async getPlans(): Promise<Plan[]> {
    const { data, error } = await getSupabaseClient()
      .from("plans")
      .select("code, sort, price_minor, currency, max_members, features")
      .order("sort");
    if (error) fail("Failed to load the plans", error);
    return (data ?? []) as Plan[];
  },

  /** Every table of the current business, for its owner. */
  async exportBusinessData(): Promise<BusinessExport> {
    const { data, error } = await getSupabaseClient().rpc(
      "export_business_data",
    );
    if (error) fail("Failed to export the data", error);
    return data as BusinessExport;
  },

  async isPlatformAdmin(): Promise<boolean> {
    const { data, error } = await getSupabaseClient().rpc("is_platform_admin");
    if (error) return false;
    return data === true;
  },

  async getPlatformBusinesses(): Promise<PlatformBusiness[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "platform_businesses",
    );
    if (error) fail("Failed to load the businesses", error);
    return (data ?? []) as PlatformBusiness[];
  },

  async setBusinessSubscription(change: SubscriptionChange): Promise<void> {
    const { error } = await getSupabaseClient().rpc(
      "set_business_subscription",
      {
        p_business_id: change.businessId,
        p_plan_code: change.plan,
        p_paid_until: change.paidUntil,
        p_amount_minor: change.amountMinor,
        p_note: change.note ?? null,
      },
    );
    if (error) fail("Failed to change the plan", error);
  },

  async updatePlan(
    code: PlanCode,
    priceMinor: number,
    maxMembers: number | null,
  ): Promise<void> {
    const { error } = await getSupabaseClient().rpc("update_plan", {
      p_code: code,
      p_price_minor: priceMinor,
      p_max_members: maxMembers,
    });
    if (error) fail("Failed to save the plan", error);
  },
};
