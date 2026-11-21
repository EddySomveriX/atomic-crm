import { useQueryClient } from "@tanstack/react-query";
import {
  useCanAccess,
  useDataProvider,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getMinorDigits } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { parsePercent } from "../team/types";
import { BulkPriceDialog } from "./BulkPriceDialog";
import type { CostData } from "./calculatedPrice";
import {
  PRICE_METHODS,
  ROUNDINGS,
  isPriceMethod,
  isRounding,
  type PriceMethod,
  type Rounding,
} from "./pricing";
import { parseAmount } from "./useCostData";

const KINDS = ["service", "goods"] as const;
type Kind = (typeof KINDS)[number];

/** Highest value of each method (public.cost_settings checks). */
const MAX_VALUE: Record<PriceMethod, number> = {
  margin: 95,
  markup: 1000,
  profit: Number.MAX_SAFE_INTEGER,
};

interface Draft {
  method: PriceMethod;
  value: string;
}

/**
 * How the business forms its prices from the cost: a rule for services and
 * one for goods, and the rounding. Opens the recalculation of all prices.
 */
export const PriceRulesCard = ({ data }: { data: CostData }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { currency } = useConfigurationContext();
  const digits = getMinorDigits(currency);
  const { canAccess: canEdit } = useCanAccess({
    resource: "costs",
    action: "edit",
  });
  const saved = data.inputs.settings;
  const shown = (method: PriceMethod, value: number) =>
    String(method === "profit" ? Number(value) / 10 ** digits : Number(value));
  const [drafts, setDrafts] = useState<Record<Kind, Draft>>({
    service: {
      method: saved.service_price_method,
      value: shown(saved.service_price_method, saved.service_price_value),
    },
    goods: {
      method: saved.goods_price_method,
      value: shown(saved.goods_price_method, saved.goods_price_value),
    },
  });
  const [rounding, setRounding] = useState<Rounding>(saved.price_rounding);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkOpen, setBulkOpen] = useState(false);

  const valueOf = ({ method, value }: Draft): number | null => {
    const parsed =
      method === "profit" ? parseAmount(value, digits) : parsePercent(value);
    return parsed == null || parsed < 0 || parsed > MAX_VALUE[method]
      ? null
      : parsed;
  };

  const save = async () => {
    const service = valueOf(drafts.service);
    const goods = valueOf(drafts.goods);
    if (service == null || goods == null) {
      notify("crm.costing.rules.invalid", { type: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      await dataProvider.saveCostSettings({
        service_price_method: drafts.service.method,
        service_price_value: service,
        goods_price_method: drafts.goods.method,
        goods_price_value: goods,
        price_rounding: rounding,
      });
      await queryClient.invalidateQueries({ queryKey: ["cost_inputs"] });
      notify("crm.costing.settings.saved", { type: "success" });
    } catch {
      notify("crm.costing.failed", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const ruleRow = (kind: Kind) => {
    const draft = drafts[kind];
    const change = (next: Partial<Draft>) =>
      setDrafts({ ...drafts, [kind]: { ...draft, ...next } });
    return (
      <div className="grid grid-cols-[5.5rem_1fr_7rem] items-center gap-2">
        <span className="text-sm font-medium">
          {translate(`crm.costing.rules.${kind}`)}
        </span>
        <Select
          value={draft.method}
          disabled={!canEdit}
          onValueChange={(next) =>
            isPriceMethod(next) ? change({ method: next }) : undefined
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label={translate("crm.costing.calculator.method")}
          >
            <SelectValue>
              {translate(`crm.costing.calculator.methods.${draft.method}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRICE_METHODS.map((item) => (
              <SelectItem key={item} value={item}>
                {translate(`crm.costing.calculator.methods.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5">
          <Input
            value={draft.value}
            disabled={!canEdit}
            onChange={(event) => change({ value: event.target.value })}
            inputMode="decimal"
            aria-label={translate("crm.costing.calculator.value")}
            aria-invalid={valueOf(draft) == null}
            className="h-9 text-right"
          />
          <span className="w-6 text-sm text-muted-foreground">
            {draft.method === "profit" ? currency : "%"}
          </span>
        </label>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {translate("crm.costing.rules.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.costing.rules.hint")}
          </p>
        </div>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {PRICE_METHODS.map((method) => (
            <li key={method}>
              <span className="font-medium text-foreground">
                {translate(`crm.costing.calculator.methods.${method}`)}
              </span>
              {": "}
              {translate(`crm.costing.rules.explain.${method}`)}
            </li>
          ))}
        </ul>
        {KINDS.map((kind) => (
          <div key={kind}>{ruleRow(kind)}</div>
        ))}
        <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
          <span className="text-sm font-medium">
            {translate("crm.costing.calculator.rounding")}
          </span>
          <Select
            value={rounding}
            disabled={!canEdit}
            onValueChange={(next) =>
              isRounding(next) ? setRounding(next) : undefined
            }
          >
            <SelectTrigger
              className="w-full"
              aria-label={translate("crm.costing.calculator.rounding")}
            >
              <SelectValue>
                {translate(`crm.costing.roundings.${rounding}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROUNDINGS.map((item) => (
                <SelectItem key={item} value={item}>
                  {translate(`crm.costing.roundings.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={isSaving}>
              {translate("crm.costing.rules.save")}
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              {translate("crm.costing.bulk.open")}
            </Button>
          </div>
        ) : null}
        {isBulkOpen ? (
          <BulkPriceDialog data={data} onClose={() => setBulkOpen(false)} />
        ) : null}
      </CardContent>
    </Card>
  );
};
