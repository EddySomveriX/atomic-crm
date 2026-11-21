import { useQueryClient } from "@tanstack/react-query";
import {
  useCanAccess,
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { formatMoney, getMinorDigits } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { parsePercent } from "../team/types";
import type { CostInputs, CostSettings } from "./types";
import { parseAmount } from "./useCostData";

type PercentField =
  "load_percent" | "tax_percent" | "card_fee_percent" | "card_share_percent";

const PERCENT_FIELDS: PercentField[] = [
  "load_percent",
  "tax_percent",
  "card_fee_percent",
  "card_share_percent",
];

/** Limits of public.cost_settings */
const PERCENT_RANGE: Record<PercentField, [number, number]> = {
  load_percent: [1, 100],
  tax_percent: [0, 99],
  card_fee_percent: [0, 99],
  card_share_percent: [0, 100],
};
const WHOLE: PercentField[] = ["load_percent", "card_share_percent"];

/** How the costs are counted: load, pay of the specialist, taxes and fees. */
export const CostSettingsCard = ({ inputs }: { inputs: CostInputs }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const { canAccess: canEdit } = useCanAccess({
    resource: "costs",
    action: "edit",
  });
  const saved = inputs.settings;
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(
      PERCENT_FIELDS.map((field) => [field, String(Number(saved[field]))]),
    ),
    hourly_rate:
      saved.hourly_rate == null
        ? ""
        : String(saved.hourly_rate / 10 ** getMinorDigits(currency)),
  }));
  const [payMode, setPayMode] = useState(saved.pay_mode);
  const [materialPrice, setMaterialPrice] = useState(saved.material_price);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const values: Partial<CostSettings> = {};
    for (const field of PERCENT_FIELDS) {
      const value = parsePercent(draft[field] ?? "");
      const [min, max] = PERCENT_RANGE[field];
      if (
        value == null ||
        value < min ||
        value > max ||
        (WHOLE.includes(field) && !Number.isInteger(value))
      ) {
        notify("crm.costing.settings.invalid", {
          type: "warning",
          messageArgs: { field: translate(`crm.costing.settings.${field}`) },
        });
        return;
      }
      values[field] = value;
    }
    const rate =
      draft.hourly_rate.trim() === ""
        ? null
        : parseAmount(draft.hourly_rate, getMinorDigits(currency));
    if (draft.hourly_rate.trim() !== "" && rate == null) {
      notify("crm.costing.settings.invalid", {
        type: "warning",
        messageArgs: { field: translate("crm.costing.settings.hourly_rate") },
      });
      return;
    }
    setIsSaving(true);
    try {
      await dataProvider.saveCostSettings({
        ...(values as CostSettings),
        hourly_rate: rate,
        pay_mode: payMode,
        material_price: materialPrice,
      });
      await queryClient.invalidateQueries({ queryKey: ["cost_inputs"] });
      notify("crm.costing.settings.saved", { type: "success" });
    } catch {
      notify("crm.costing.failed", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const field = (name: PercentField | "hourly_rate", suffix: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">
        {translate(`crm.costing.settings.${name}`)}
      </span>
      <span className="flex items-center gap-1.5">
        <Input
          value={draft[name] ?? ""}
          onChange={(event) =>
            setDraft({ ...draft, [name]: event.target.value })
          }
          inputMode="decimal"
          disabled={!canEdit}
          className="h-9 w-24 text-right"
        />
        <span className="text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );

  const choice = <T extends string>(
    value: T,
    options: readonly T[],
    onChange: (next: T) => void,
    prefix: string,
  ) => (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={!canEdit}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            value === option
              ? "border-primary bg-accent font-medium"
              : "text-muted-foreground hover:bg-accent/60",
          )}
        >
          {translate(`${prefix}.${option}`)}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {translate("crm.costing.settings.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.costing.settings.hint")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {translate("crm.costing.settings.pay_mode")}
          </span>
          {choice(
            payMode,
            ["commission", "hourly"] as const,
            setPayMode,
            "crm.costing.settings.pay_modes",
          )}
          {payMode === "commission" ? (
            <p className="text-sm text-muted-foreground">
              {inputs.commission_percent == null
                ? translate("crm.costing.settings.no_commission")
                : translate("crm.costing.settings.commission", {
                    percent: Number(inputs.commission_percent),
                  })}
            </p>
          ) : (
            field("hourly_rate", currency)
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {field("load_percent", "%")}
          {field("tax_percent", "%")}
          {field("card_fee_percent", "%")}
          {field("card_share_percent", "%")}
        </div>
        {inputs.income_taxes.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {translate("crm.costing.settings.tax_hint")}{" "}
            {inputs.income_taxes
              .map((tax) =>
                translate(`crm.costing.taxes.${tax.code}`, { _: tax.label }),
              )
              .join("; ")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {translate("crm.costing.settings.material_price")}
          </span>
          {choice(
            materialPrice,
            ["average", "last"] as const,
            setMaterialPrice,
            "crm.costing.settings.material_prices",
          )}
        </div>

        <p className="text-sm">
          {inputs.working_minutes_month > 0
            ? translate("crm.costing.settings.minute_cost", {
                overhead: formatMoney(
                  inputs.overhead_monthly,
                  currency,
                  locale,
                ),
                hours: Math.round(
                  (inputs.working_minutes_month * saved.load_percent) /
                    100 /
                    60,
                ),
              })
            : translate("crm.costing.settings.no_hours")}
        </p>

        {canEdit ? (
          <div>
            <Button onClick={save} disabled={isSaving}>
              {translate("ra.action.save")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
