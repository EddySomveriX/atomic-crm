import { Building2 } from "lucide-react";
import { useLocaleState, useTranslate } from "ra-core";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { EmptyState, ErrorState, LoadingRows } from "../misc/PageStates";
import type { PlatformBusiness } from "../subscription/types";
import { useIsPlatformAdmin, usePlans } from "../subscription/useSubscription";
import { PlanPricesCard } from "./PlanPricesCard";
import { SetPlanDialog } from "./SetPlanDialog";
import { usePlatformBusinesses } from "./usePlatform";

const STATUS_VARIANT = {
  trial: "secondary",
  active: "default",
  read_only: "destructive",
} as const;

const BusinessRow = ({
  business,
  onChange,
}: {
  business: PlatformBusiness;
  onChange: () => void;
}) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { subscription } = business;
  const ends = subscription.ends_at
    ? new Intl.DateTimeFormat(uiLocale, { dateStyle: "medium" }).format(
        new Date(
          subscription.ends_at.length === 10
            ? `${subscription.ends_at}T00:00:00`
            : subscription.ends_at,
        ),
      )
    : "";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{business.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {business.owner_email ?? ""} ·{" "}
          {translate("crm.platform.people", { smart_count: business.members })}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 text-sm">
        <Badge variant={STATUS_VARIANT[subscription.status]}>
          {subscription.status === "trial"
            ? translate("crm.platform.status.trial")
            : subscription.status === "active"
              ? translate(`crm.subscription.plans.${subscription.plan}.name`)
              : translate("crm.platform.status.read_only")}
        </Badge>
        {ends ? (
          <span className="text-muted-foreground">
            {translate("crm.platform.until", { date: ends })}
          </span>
        ) : null}
      </div>
      <Button size="sm" variant="outline" onClick={onChange}>
        {translate("crm.platform.change")}
      </Button>
    </li>
  );
};

/**
 * The platform owner's desk: every business, its plan and end date, and the
 * place to turn a plan on after a payment and to set prices.
 */
export const PlatformPage = () => {
  const translate = useTranslate();
  const isAdmin = useIsPlatformAdmin();
  const businesses = usePlatformBusinesses();
  const plans = usePlans();
  const [editing, setEditing] = useState<PlatformBusiness | null>(null);

  if (!isAdmin) {
    return (
      <EmptyState
        className="mx-auto my-8 max-w-lg"
        icon={Building2}
        title={translate("crm.platform.only_admins")}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        {translate("crm.platform.title")}
      </h1>
      {businesses.isPending ? (
        <LoadingRows rows={4} />
      ) : businesses.error ? (
        <ErrorState onRetry={() => businesses.refetch()} />
      ) : businesses.data.length === 0 ? (
        <EmptyState icon={Building2} title={translate("crm.platform.empty")} />
      ) : (
        <ul className="rounded-xl border px-4">
          {businesses.data.map((business) => (
            <BusinessRow
              key={business.id}
              business={business}
              onChange={() => setEditing(business)}
            />
          ))}
        </ul>
      )}
      {plans.data ? <PlanPricesCard plans={plans.data} /> : null}
      {editing ? (
        <SetPlanDialog
          business={editing}
          plans={plans.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};

PlatformPage.path = "/platform";
