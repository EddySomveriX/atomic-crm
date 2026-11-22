import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fromMinor, toMinor } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import type { Plan } from "../subscription/types";
import { PLANS_QUERY_KEY } from "../subscription/useSubscription";

/** One plan: its monthly price and how many people it holds. */
const PlanRow = ({ plan }: { plan: Plan }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [price, setPrice] = useState(
    String(fromMinor(plan.price_minor, plan.currency)),
  );
  const [members, setMembers] = useState(
    plan.max_members == null ? "" : String(plan.max_members),
  );
  const priceNumber = Number(price);
  const membersNumber = members.trim() === "" ? null : Number(members);
  const isValid =
    price.trim() !== "" &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0 &&
    (membersNumber == null ||
      (Number.isInteger(membersNumber) && membersNumber > 0));

  const handleSave = async () => {
    try {
      await dataProvider.updatePlan(
        plan.code,
        toMinor(priceNumber, plan.currency),
        membersNumber,
      );
      await queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
      notify("crm.platform.saved", { type: "success" });
    } catch (error: unknown) {
      console.error("plan update failed:", error);
      notify("crm.platform.save_error", { type: "error" });
    }
  };

  return (
    <li className="flex flex-wrap items-end gap-3">
      <p className="w-24 font-medium">
        {translate(`crm.subscription.plans.${plan.code}.name`)}
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`price-${plan.code}`}>
          {translate("crm.platform.price", { currency: plan.currency })}
        </Label>
        <Input
          id={`price-${plan.code}`}
          className="w-32"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`members-${plan.code}`}>
          {translate("crm.platform.max_members")}
        </Label>
        <Input
          id={`members-${plan.code}`}
          className="w-32"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={translate("crm.platform.no_limit")}
          value={members}
          onChange={(event) => setMembers(event.target.value)}
        />
      </div>
      <Button variant="outline" onClick={handleSave} disabled={!isValid}>
        {translate("ra.action.save")}
      </Button>
    </li>
  );
};

export const PlanPricesCard = ({ plans }: { plans: Plan[] }) => {
  const translate = useTranslate();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {translate("crm.platform.prices_title")}
        </h2>
        <ul className="flex flex-col gap-4">
          {plans.map((plan) => (
            <PlanRow key={plan.code} plan={plan} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
