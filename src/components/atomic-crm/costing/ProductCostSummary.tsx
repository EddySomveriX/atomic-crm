import { useLocaleState, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { computeCost } from "./costCalc";
import { formatPercent, useCostData } from "./useCostData";

/** Cost and profit of one service or goods on its card, for those who see costs. */
export const ProductCostSummary = ({ product }: { product: Product }) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const { canRead, inputs, products, materials, items } = useCostData({
    enabled: product.kind !== "material",
  });
  if (!canRead || !inputs || product.kind === "material") return null;
  const current = products.find((item) => item.id === product.id) ?? product;
  const result = computeCost({
    product: current,
    materials: materials.filter((item) => item.service_id === product.id),
    stock: products,
    items: items.filter((item) => item.product_id === product.id),
    inputs,
  });
  const money = (minor: number | null) =>
    minor == null ? "—" : formatMoney(minor, currency, locale);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">
            {translate("crm.costing.card_title")}
          </span>
          <span className="tabular-nums">
            {translate("crm.costing.card_summary", {
              cost: money(result.total),
              profit: money(result.profit),
            })}{" "}
            <span
              className={cn(
                "font-semibold",
                result.profit != null &&
                  result.profit < 0 &&
                  "text-destructive",
              )}
            >
              {formatPercent(result.marginPercent, locale)}
            </span>
          </span>
        </div>
        <Link
          to={`/prices?tab=costs&product=${product.id}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {translate("crm.costing.card_link")}
        </Link>
      </CardContent>
    </Card>
  );
};
