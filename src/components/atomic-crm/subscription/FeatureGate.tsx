import { Lock } from "lucide-react";
import { useTranslate } from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

import { EmptyState } from "../misc/PageStates";
import { cheapestPlanWith } from "./subscriptionLogic";
import type { PlanFeature } from "./types";
import { usePlans, useSubscription } from "./useSubscription";

export const SUBSCRIPTION_PATH = "/subscription";

/**
 * Shows a section only when the plan includes it; otherwise says which plan
 * opens it. A read-only business still sees its data here (the server stops
 * the writes), so nothing it had is hidden after a missed payment.
 */
export const FeatureGate = ({
  feature,
  children,
}: {
  feature: PlanFeature;
  children: ReactNode;
}) => {
  const translate = useTranslate();
  const { data: subscription } = useSubscription();
  const { data: plans = [] } = usePlans();

  const isLocked =
    subscription != null &&
    subscription.status === "active" &&
    !subscription.features.includes(feature);
  if (!isLocked) return <>{children}</>;

  const plan = cheapestPlanWith(plans, feature);
  return (
    <EmptyState
      className="mx-auto my-8 max-w-lg"
      icon={Lock}
      title={translate("crm.subscription.locked.title", {
        plan: translate(`crm.subscription.plans.${plan?.code ?? "pro"}.name`),
      })}
      text={translate(`crm.subscription.features.${feature}`)}
      action={
        <Button nativeButton={false} render={<Link to={SUBSCRIPTION_PATH} />}>
          {translate("crm.subscription.locked.action")}
        </Button>
      }
    />
  );
};
