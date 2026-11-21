import { useQueryClient } from "@tanstack/react-query";
import {
  useCanAccess,
  useCreate,
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getMinorDigits } from "../money/money";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { parsePercent } from "../team/types";
import { useUndoableDelete } from "../misc/useUndoableDelete";
import { calculatedPriceOf, type CostData } from "./calculatedPrice";
import { computeCost } from "./costCalc";
import {
  PRICE_METHODS,
  ROUNDINGS,
  businessRule,
  isPriceMethod,
  isRounding,
  type PriceMethod,
  type PriceRule,
  type Rounding,
} from "./pricing";
import { formatPercent, parseAmount } from "./useCostData";
import { usePriceRuleText } from "./usePriceRuleText";

const BUSINESS = "business";

/**
 * The price calculator of one service or goods: the business rule or a rule
 * of its own (margin, markup or profit), a rounding, the resulting price
 * with its cost and profit, and a button that puts it into the price list.
 */
export const PriceCalculator = ({
  product,
  data,
  money,
}: {
  product: Product;
  data: CostData;
  money: (minor: number | null) => string;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const digits = getMinorDigits(currency);
  const minorPerUnit = 10 ** digits;
  const ruleText = usePriceRuleText();
  const { canAccess: canEdit } = useCanAccess({
    resource: "costs",
    action: "edit",
  });
  const saved = calculatedPriceOf(product, data, minorPerUnit);
  const own = saved.own;

  const [method, setMethod] = useState<PriceMethod | typeof BUSINESS>(
    own?.method ?? BUSINESS,
  );
  const [valueText, setValueText] = useState(() =>
    own?.value == null
      ? ""
      : own.method === "profit"
        ? String(Number(own.value) / minorPerUnit)
        : String(Number(own.value)),
  );
  const [rounding, setRounding] = useState<Rounding | typeof BUSINESS>(
    own?.rounding ?? BUSINESS,
  );

  const business = businessRule(data.inputs.settings, product.kind);
  const typedValue =
    method === "profit"
      ? parseAmount(valueText, digits)
      : parsePercent(valueText);
  const rule: PriceRule | null =
    method === BUSINESS
      ? business
      : typedValue == null
        ? null
        : { method, value: typedValue };
  const appliedRounding: Rounding =
    rounding === BUSINESS ? data.inputs.settings.price_rounding : rounding;
  const trial = rule
    ? calculatedPriceOf(product, data, minorPerUnit, {
        rule,
        rounding: appliedRounding,
      })
    : null;
  const price = trial?.suggested ?? null;
  const atPrice =
    price == null
      ? null
      : computeCost({
          product,
          price,
          materials: data.materials.filter(
            (item) => item.service_id === product.id,
          ),
          stock: data.products,
          items: data.items.filter((item) => item.product_id === product.id),
          inputs: data.inputs,
        });

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div>
        <h3 className="font-medium">
          {translate("crm.costing.calculator.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {translate("crm.costing.calculator.hint")}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr]">
        <Select
          value={method}
          onValueChange={(next) =>
            setMethod(isPriceMethod(next) ? next : BUSINESS)
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label={translate("crm.costing.calculator.method")}
          >
            <SelectValue>
              {method === BUSINESS
                ? translate("crm.costing.calculator.business_rule", {
                    rule: ruleText(business),
                  })
                : translate(`crm.costing.calculator.methods.${method}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BUSINESS}>
              {translate("crm.costing.calculator.business_rule", {
                rule: ruleText(business),
              })}
            </SelectItem>
            {PRICE_METHODS.map((item) => (
              <SelectItem key={item} value={item}>
                {translate(`crm.costing.calculator.methods.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5">
          <Input
            value={method === BUSINESS ? "" : valueText}
            disabled={method === BUSINESS}
            onChange={(event) => setValueText(event.target.value)}
            inputMode="decimal"
            aria-label={translate("crm.costing.calculator.value")}
            aria-invalid={method !== BUSINESS && rule == null}
            className="h-9 text-right"
          />
          <span className="w-6 text-sm text-muted-foreground">
            {method === "profit" ? currency : "%"}
          </span>
        </label>
        <Select
          value={rounding}
          onValueChange={(next) =>
            setRounding(isRounding(next) ? next : BUSINESS)
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label={translate("crm.costing.calculator.rounding")}
          >
            <SelectValue>
              {rounding === BUSINESS
                ? translate("crm.costing.calculator.rounding_business", {
                    rounding: translate(
                      `crm.costing.roundings.${data.inputs.settings.price_rounding}`,
                    ),
                  })
                : translate(`crm.costing.roundings.${rounding}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BUSINESS}>
              {translate("crm.costing.calculator.rounding_business", {
                rounding: translate(
                  `crm.costing.roundings.${data.inputs.settings.price_rounding}`,
                ),
              })}
            </SelectItem>
            {ROUNDINGS.map((item) => (
              <SelectItem key={item} value={item}>
                {translate(`crm.costing.roundings.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {translate("crm.costing.calculator.result")}
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {money(price)}
          </span>
          <span className="text-xs text-muted-foreground">
            {atPrice
              ? translate("crm.costing.calculator.explain", {
                  cost: money(atPrice.total),
                  profit: money(atPrice.profit),
                  margin: formatPercent(atPrice.marginPercent, locale),
                })
              : trial?.cost.isIncomplete
                ? translate("crm.costing.incomplete")
                : translate("crm.costing.calculator.impossible")}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {translate("crm.costing.calculator.current", {
            price: money(product.price),
          })}
        </span>
      </div>

      {canEdit ? (
        <CalculatorActions
          product={product}
          own={own}
          price={price}
          rule={method === BUSINESS ? null : rule}
          rounding={rounding === BUSINESS ? null : rounding}
        />
      ) : null}
    </section>
  );
};

const CalculatorActions = ({
  product,
  own,
  price,
  rule,
  rounding,
}: {
  product: Product;
  own: CostData["rules"][number] | null;
  price: number | null;
  /** A rule of its own; null to follow the business rule */
  rule: PriceRule | null;
  rounding: Rounding | null;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [create] = useCreate();
  const [update] = useUpdate();
  const deleteWithUndo = useUndoableDelete();
  const [isSaving, setIsSaving] = useState(false);

  const apply = async () => {
    if (price == null) return;
    setIsSaving(true);
    const data = {
      method: rule?.method ?? null,
      value: rule?.value ?? null,
      rounding,
    };
    try {
      if (own) {
        await update(
          "product_price_rules",
          { id: own.id, data, previousData: own },
          { returnPromise: true },
        );
      } else {
        await create(
          "product_price_rules",
          { data: { product_id: product.id, ...data } },
          { returnPromise: true },
        );
      }
      await dataProvider.applyCalculatedPrices([{ id: product.id, price }]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product_price_rules"] }),
      ]);
      notify("crm.costing.calculator.applied", { type: "success" });
    } catch {
      notify("crm.costing.failed", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={apply} disabled={price == null || isSaving}>
        {translate("crm.costing.calculator.apply")}
      </Button>
      {own ? (
        <Button
          variant="ghost"
          onClick={() =>
            deleteWithUndo("product_price_rules", own, {
              errorMessage: "crm.costing.failed",
            })
          }
        >
          {translate("crm.costing.calculator.unlink")}
        </Button>
      ) : null}
    </div>
  );
};
