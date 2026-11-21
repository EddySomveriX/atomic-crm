import { useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatMoney, getMinorDigits } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { calculatedPriceOf, isPriced, type CostData } from "./calculatedPrice";

/**
 * Every service and goods whose calculated price differs from the list
 * price: the old and the new price side by side, ticked by default; the
 * ticked ones go into the price list at once.
 */
export const BulkPriceDialog = ({
  data,
  onClose,
}: {
  data: CostData;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const minorPerUnit = 10 ** getMinorDigits(currency);
  const money = (minor: number | null) =>
    minor == null ? "—" : formatMoney(minor, currency, locale);

  const rows = data.products
    .filter(isPriced)
    .map((product) => calculatedPriceOf(product, data, minorPerUnit))
    .filter(
      (row) => row.suggested != null && row.suggested !== row.product.price,
    );
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(rows.map((row) => String(row.product.id))),
  );
  const [isSaving, setIsSaving] = useState(false);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  const apply = async () => {
    const prices = rows
      .filter((row) => chosen.has(String(row.product.id)))
      .map((row) => ({ id: row.product.id, price: row.suggested! }));
    if (prices.length === 0) return;
    setIsSaving(true);
    try {
      const changed = await dataProvider.applyCalculatedPrices(prices);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product_price_rules"] }),
      ]);
      notify("crm.costing.bulk.applied", {
        type: "success",
        messageArgs: { smart_count: changed },
      });
      onClose();
    } catch {
      notify("crm.costing.failed", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[85dvh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{translate("crm.costing.bulk.title")}</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.costing.bulk.nothing")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {translate("crm.costing.bulk.hint")}
            </p>
            <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
              {rows.map(({ product, suggested }) => {
                const id = String(product.id);
                return (
                  <li key={id}>
                    <label className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        checked={chosen.has(id)}
                        onCheckedChange={() => toggle(id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {product.name}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums line-through">
                        {money(product.price)}
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                        {money(suggested)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          {rows.length > 0 ? (
            <Button onClick={apply} disabled={isSaving || chosen.size === 0}>
              {translate("crm.costing.bulk.apply", {
                smart_count: chosen.size,
              })}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
