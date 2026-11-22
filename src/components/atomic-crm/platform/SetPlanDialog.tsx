import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toMinor } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import {
  PLAN_CODES,
  type Plan,
  type PlanCode,
  type PlatformBusiness,
} from "../subscription/types";
import { PLATFORM_QUERY_KEY } from "./usePlatform";

const DEFAULT_MONTHS = 1;

/** YYYY-MM-DD of the day a number of months from today. */
const monthsFromToday = (months: number): string => {
  const day = new Date();
  day.setMonth(day.getMonth() + months);
  return day.toLocaleDateString("sv-SE");
};

/** Turns a plan on for a business until a day, recording the payment. */
export const SetPlanDialog = ({
  business,
  plans,
  onClose,
}: {
  business: PlatformBusiness;
  plans: Plan[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [plan, setPlan] = useState<PlanCode>(
    business.subscription.plan ?? "business",
  );
  const [paidUntil, setPaidUntil] = useState(monthsFromToday(DEFAULT_MONTHS));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const currency = plans.find((item) => item.code === plan)?.currency ?? "UAH";
  const amountNumber = amount.trim() === "" ? 0 : Number(amount);
  const isValid =
    /^\d{4}-\d{2}-\d{2}$/.test(paidUntil) &&
    Number.isFinite(amountNumber) &&
    amountNumber >= 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dataProvider.setBusinessSubscription({
        businessId: business.id,
        plan,
        paidUntil,
        amountMinor: toMinor(amountNumber, currency),
        note,
      });
      await queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEY });
      notify("crm.platform.saved", { type: "success" });
      onClose();
    } catch (error: unknown) {
      console.error("plan change failed:", error);
      notify("crm.platform.save_error", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("crm.platform.set_plan_title", { name: business.name })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{translate("crm.platform.plan")}</Label>
            <Select
              value={plan}
              onValueChange={(value) => value && setPlan(value as PlanCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {translate(`crm.subscription.plans.${plan}.name`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PLAN_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {translate(`crm.subscription.plans.${code}.name`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="paid-until">
              {translate("crm.platform.paid_until")}
            </Label>
            <Input
              id="paid-until"
              type="date"
              value={paidUntil}
              onChange={(event) => setPaidUntil(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="paid-amount">
              {translate("crm.platform.amount", { currency })}
            </Label>
            <Input
              id="paid-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="paid-note">{translate("crm.platform.note")}</Label>
            <Input
              id="paid-note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {translate("crm.platform.turn_on")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
