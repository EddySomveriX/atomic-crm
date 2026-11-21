import { useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";

import { formatMoney, getMinorDigits } from "../money/money";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { calculatedPriceOf, isPriced, type CostData } from "./calculatedPrice";

/**
 * Under a row of the price list: a price that came from the calculation
 * offers the new calculated price when the cost moved; every row links to
 * its calculator, where the rule can be changed.
 */
export const PriceListCalc = ({
  product,
  data,
}: {
  product: Product;
  data: CostData;
}) => {
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
  const [isSaving, setIsSaving] = useState(false);
  if (!isPriced(product)) return null;

  const { own, suggested } = calculatedPriceOf(
    product,
    data,
    10 ** getMinorDigits(currency),
  );
  const isStale =
    own != null && suggested != null && suggested !== product.price;
  const calculatorLink = (
    <Link
      to={`/prices?tab=costs&product=${product.id}`}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <Calculator />
      {own
        ? translate("crm.pricing.calc.from_calculation")
        : translate("crm.pricing.calc.calculate")}
    </Link>
  );

  const update = async () => {
    if (suggested == null) return;
    setIsSaving(true);
    try {
      await dataProvider.applyCalculatedPrices([
        { id: product.id, price: suggested },
      ]);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify("crm.costing.calculator.applied", { type: "success" });
    } catch {
      notify("crm.costing.failed", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex basis-full flex-wrap items-center gap-2 text-sm">
      {isStale ? (
        <>
          <span className="text-muted-foreground">
            {translate("crm.pricing.calc.new_price", {
              price: formatMoney(suggested, product.currency, locale),
            })}
          </span>
          {canEdit ? (
            <Button size="sm" onClick={update} disabled={isSaving}>
              {translate("crm.pricing.calc.update")}
            </Button>
          ) : null}
        </>
      ) : null}
      {calculatorLink}
    </div>
  );
};
