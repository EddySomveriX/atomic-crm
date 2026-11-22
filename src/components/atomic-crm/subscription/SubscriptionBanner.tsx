import { CircleAlert, Clock } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import { SUBSCRIPTION_PATH } from "./FeatureGate";
import { bannerKind, daysLeft } from "./subscriptionLogic";
import { useSubscription } from "./useSubscription";

/**
 * A line on every screen when it matters: the trial or the paid period ends
 * within a week, or the business is read-only until it pays. On a phone it
 * floats above the bottom menu (each phone screen owns its fixed header).
 */
export const SubscriptionBanner = ({
  floating = false,
}: {
  floating?: boolean;
}) => {
  const translate = useTranslate();
  const { data: subscription } = useSubscription();
  const now = new Date();
  const kind = bannerKind(subscription, now);
  if (!subscription || !kind) return null;

  const isReadOnly = kind === "read_only";
  const Icon = isReadOnly ? CircleAlert : Clock;
  const text = isReadOnly
    ? translate("crm.subscription.banner.read_only")
    : translate(
        subscription.status === "trial"
          ? "crm.subscription.banner.trial_ending"
          : "crm.subscription.banner.paid_ending",
        { smart_count: daysLeft(subscription, now) },
      );

  const banner = (
    <div
      role={isReadOnly ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm",
        isReadOnly ? "border-destructive/40 bg-destructive/10" : "bg-accent",
        !floating && "mb-4",
      )}
    >
      <Icon
        className={isReadOnly ? "size-4 text-destructive" : "size-4"}
        aria-hidden
      />
      <span className="min-w-0 flex-1">{text}</span>
      <Link
        to={SUBSCRIPTION_PATH}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {translate("crm.subscription.banner.action")}
      </Link>
    </div>
  );
  if (!floating) return banner;
  // An opaque card under the tinted banner, so the list behind does not show
  return (
    <div className="fixed inset-x-3 bottom-[76px] z-40 rounded-lg bg-background shadow-lg">
      {banner}
    </div>
  );
};
