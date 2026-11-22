import { CanAccess, useLocaleState, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ErrorState, LoadingRows } from "../misc/PageStates";
import { ExportDataButton } from "./ExportDataButton";
import { SUBSCRIPTION_PATH } from "./FeatureGate";
import { PlanCards } from "./PlanCards";
import { daysLeft } from "./subscriptionLogic";
import type { Subscription } from "./types";
import { usePlans, useSubscription } from "./useSubscription";

/** Where people write to pay or change the plan (a link), set per install. */
const BILLING_CONTACT: string | undefined = import.meta.env
  .VITE_BILLING_CONTACT;

const useStatusText = (subscription: Subscription): string => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const now = new Date();
  if (subscription.status === "trial") {
    return translate("crm.subscription.status.trial", {
      smart_count: daysLeft(subscription, now),
    });
  }
  if (subscription.status === "active" && subscription.ends_at) {
    return translate("crm.subscription.status.active", {
      date: new Intl.DateTimeFormat(uiLocale, { dateStyle: "long" }).format(
        new Date(`${subscription.ends_at}T00:00:00`),
      ),
    });
  }
  return translate("crm.subscription.status.read_only");
};

const StatusCard = ({ subscription }: { subscription: Subscription }) => {
  const translate = useTranslate();
  const statusText = useStatusText(subscription);
  const planName = translate(
    `crm.subscription.plans.${subscription.plan ?? "start"}.name`,
  );
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {subscription.status === "trial"
            ? translate("crm.subscription.trial_title")
            : translate("crm.subscription.plan_title", { plan: planName })}
        </h2>
        <p
          className={
            subscription.status === "read_only" ? "text-destructive" : undefined
          }
        >
          {statusText}
        </p>
        <p className="text-sm text-muted-foreground">
          {subscription.max_members == null
            ? translate("crm.subscription.team_unlimited", {
                smart_count: subscription.members,
              })
            : translate("crm.subscription.team_of", {
                count: subscription.members,
                max: subscription.max_members,
              })}
        </p>
        <p className="text-sm">{translate("crm.subscription.how_to_pay")}</p>
        {BILLING_CONTACT ? (
          <div>
            <Button
              nativeButton={false}
              render={
                <a href={BILLING_CONTACT} target="_blank" rel="noreferrer" />
              }
            >
              {translate("crm.subscription.contact")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export const SubscriptionPage = () => {
  const translate = useTranslate();
  const subscription = useSubscription();
  const plans = usePlans();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        {translate("crm.subscription.title")}
      </h1>
      {subscription.isPending || plans.isPending ? (
        <LoadingRows rows={3} />
      ) : subscription.error || plans.error || !subscription.data ? (
        <ErrorState
          onRetry={() => {
            subscription.refetch();
            plans.refetch();
          }}
        />
      ) : (
        <>
          <StatusCard subscription={subscription.data} />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {translate("crm.subscription.plans_title")}
            </h2>
            <PlanCards
              plans={plans.data}
              current={
                subscription.data.status === "trial"
                  ? null
                  : subscription.data.plan
              }
            />
          </section>
        </>
      )}
      <CanAccess resource="configuration" action="edit">
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <h2 className="text-lg font-semibold">
              {translate("crm.subscription.export.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translate("crm.subscription.export.text")}
            </p>
            <ExportDataButton />
          </CardContent>
        </Card>
      </CanAccess>
    </div>
  );
};

SubscriptionPage.path = SUBSCRIPTION_PATH;
