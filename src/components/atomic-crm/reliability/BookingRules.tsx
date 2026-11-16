import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { Business } from "../business/types";
import type { CrmDataProvider } from "../providers/types";

/**
 * Booking rules of the business (owner only): how many hours before a visit
 * a client can still cancel or move it for free, and whether unreliable
 * clients may book online. Each change saves at once.
 */
export const BookingRules = ({ business }: { business: Business }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [hours, setHours] = useState(String(business.free_cancel_hours));

  const save = useMutation({
    mutationFn: (
      changes: Partial<
        Pick<Business, "free_cancel_hours" | "block_unreliable">
      >,
    ) => dataProvider.updateBusiness(business.id, changes),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
    onError: () => notify("crm.reliability.rules_failed", { type: "error" }),
  });

  const saveHours = () => {
    const value = Number(hours);
    if (Number.isInteger(value) && value >= 0 && value <= 168) {
      if (value !== business.free_cancel_hours) {
        save.mutate({ free_cancel_hours: value });
      }
    } else {
      setHours(String(business.free_cancel_hours));
    }
  };

  return (
    <section id="booking-rules" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">
          {translate("crm.reliability.rules_title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate("crm.reliability.rules_hint")}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="free-cancel-hours">
          {translate("crm.reliability.free_cancel_hours")}
        </Label>
        <Input
          id="free-cancel-hours"
          type="number"
          min={0}
          max={168}
          className="w-28"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          onBlur={saveHours}
        />
        <p className="text-sm text-muted-foreground">
          {translate("crm.reliability.free_cancel_hint")}
        </p>
      </div>
      <label
        htmlFor="block-unreliable"
        className="flex cursor-pointer items-start gap-3"
      >
        <Switch
          id="block-unreliable"
          defaultChecked={business.block_unreliable}
          onCheckedChange={(checked) =>
            save.mutate({ block_unreliable: checked })
          }
        />
        <span className="flex flex-col">
          <span className="font-medium">
            {translate("crm.reliability.block_unreliable")}
          </span>
          <span className="text-sm text-muted-foreground">
            {translate("crm.reliability.block_unreliable_hint")}
          </span>
        </span>
      </label>
    </section>
  );
};
