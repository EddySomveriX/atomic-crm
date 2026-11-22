import { Check } from "lucide-react";
import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Plan, PlanCode, PlanFeature } from "./types";

/** What every plan has, then what the larger ones add, in this order. */
const FEATURE_ORDER: PlanFeature[] = [
  "messengers",
  "booking_page",
  "automations",
  "marketing",
  "costing",
  "weekly_report",
  "business_map",
  "ai",
];

/** The three plans side by side (one under another on a phone). */
export const PlanCards = ({
  plans,
  current,
}: {
  plans: Plan[];
  current: PlanCode | null;
}) => {
  const translate = useTranslate();
  const { locale } = useConfigurationContext();

  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.code === current;
        return (
          <li
            key={plan.code}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4",
              isCurrent && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                {translate(`crm.subscription.plans.${plan.code}.name`)}
              </h3>
              {isCurrent ? (
                <Badge>{translate("crm.subscription.current")}</Badge>
              ) : null}
            </div>
            <p>
              <span className="text-2xl font-semibold tabular-nums">
                {formatMoney(plan.price_minor, plan.currency, locale)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">
                {translate("crm.subscription.per_month")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {translate(`crm.subscription.plans.${plan.code}.text`)}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
                {plan.max_members == null
                  ? translate("crm.subscription.members_unlimited")
                  : translate("crm.subscription.members_up_to", {
                      smart_count: plan.max_members,
                    })}
              </li>
              {FEATURE_ORDER.filter((feature) =>
                plan.features.includes(feature),
              ).map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  {translate(`crm.subscription.feature_names.${feature}`)}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
};
