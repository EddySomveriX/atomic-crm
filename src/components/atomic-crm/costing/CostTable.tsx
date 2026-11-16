import { ChevronDown } from "lucide-react";
import { useLocaleState, useTranslate } from "ra-core";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { formatMoney } from "../money/money";
import type { ServiceMaterial } from "../products/materialCost";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CostBreakdown } from "./CostBreakdown";
import { computeCost, type CostResult } from "./costCalc";
import type { CostInputs, ProductCostItem } from "./types";
import { formatPercent } from "./useCostData";

const FILTERS = ["all", "service", "goods", "loss"] as const;
type Filter = (typeof FILTERS)[number];

export interface CostedRow {
  product: Product;
  result: CostResult;
}

/** Cost and profit of every service and goods, the loss-making ones in red. */
export const CostTable = ({
  inputs,
  products,
  materials,
  items,
  openId,
}: {
  inputs: CostInputs;
  products: Product[];
  materials: ServiceMaterial[];
  items: ProductCostItem[];
  /** A product to open from a link */
  openId?: string | null;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const money = (minor: number | null) =>
    minor == null ? "—" : formatMoney(minor, currency, locale);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(openId ?? null);

  const rows: CostedRow[] = products
    .filter((product) => product.kind !== "material")
    .map((product) => ({
      product,
      result: computeCost({
        product,
        materials: materials.filter((item) => item.service_id === product.id),
        stock: products,
        items: items.filter((item) => item.product_id === product.id),
        inputs,
      }),
    }))
    .sort(
      (a, b) =>
        Number(b.product.kind === "service") -
        Number(a.product.kind === "service"),
    );
  const shown = rows.filter(({ product, result }) =>
    filter === "all"
      ? true
      : filter === "loss"
        ? result.profit != null && result.profit < 0
        : product.kind === filter,
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              filter === item
                ? "border-primary bg-accent font-medium"
                : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            {translate(`crm.costing.filters.${item}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.costing.empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {shown.map(({ product, result }) => {
            const isOpen = open === String(product.id);
            const isLoss = result.profit != null && result.profit < 0;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : String(product.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {product.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {translate("crm.costing.row_summary", {
                        price: money(result.price),
                        cost: money(result.total),
                      })}
                      {result.isIncomplete
                        ? ` ${translate("crm.costing.incomplete_mark")}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        isLoss && "text-destructive",
                      )}
                    >
                      {money(result.profit)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatPercent(result.marginPercent, locale)}
                      {result.profitPerHour != null
                        ? `, ${translate("crm.costing.per_hour", {
                            amount: money(result.profitPerHour),
                          })}`
                        : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen ? (
                  <CostBreakdown
                    product={product}
                    inputs={inputs}
                    materials={materials.filter(
                      (item) => item.service_id === product.id,
                    )}
                    stock={products}
                    items={items.filter(
                      (item) => item.product_id === product.id,
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
