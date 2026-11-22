/** Plans a business runs on (public.plans, supabase/schemas/32_subscriptions.sql). */
export const PLAN_CODES = ["start", "business", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Features a plan turns on; the same list as the plans_features check. */
export type PlanFeature =
  | "messengers"
  | "automations"
  | "marketing"
  | "booking_page"
  | "weekly_report"
  | "costing"
  | "business_map"
  | "ai";

export type SubscriptionStatus = "trial" | "active" | "read_only";

/** Where the current business stands (public.current_subscription). */
export interface Subscription {
  plan: PlanCode | null;
  status: SubscriptionStatus;
  /** End of the trial (a moment) or the last paid day (a date) */
  ends_at: string | null;
  features: PlanFeature[];
  /** null: no limit */
  max_members: number | null;
  /** Active members and pending invitations */
  members: number;
}

export interface Plan {
  code: PlanCode;
  sort: number;
  price_minor: number;
  currency: string;
  max_members: number | null;
  features: PlanFeature[];
}

/** A business as the platform admin sees it (public.platform_businesses). */
export interface PlatformBusiness {
  id: string;
  name: string;
  country_code: string | null;
  created_at: string;
  owner_email: string | null;
  members: number;
  subscription: Omit<Subscription, "members">;
}

export interface SubscriptionChange {
  businessId: string;
  plan: PlanCode;
  /** Last paid day, YYYY-MM-DD */
  paidUntil: string;
  amountMinor: number;
  note?: string;
}

/** Every business table of the current business, as exported. */
export type BusinessExport = Record<string, Record<string, unknown>[]>;
