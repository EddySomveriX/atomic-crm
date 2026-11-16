import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";
import { Percent } from "lucide-react";
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

import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { changedPrice, groupByCategory } from "./priceList";

const ALL = "__all";

/**
 * Raises or lowers prices by a percent, for one category or all of them,
 * with the new prices shown before anything is saved.
 */
export const BulkPriceChange = ({ products }: { products: Product[] }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { locale } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(ALL);
  const [percent, setPercent] = useState("10");

  const categories = groupByCategory(products)
    .map((group) => group.category)
    .filter((item): item is string => item != null);
  const chosen = products.filter(
    (item) =>
      item.price != null &&
      (category === ALL || (item.category?.trim() || null) === category),
  );
  const value = Number(percent.replace(",", "."));
  const isValid =
    Number.isFinite(value) && value !== 0 && value >= -90 && value <= 500;

  const apply = useMutation({
    mutationFn: () =>
      dataProvider.changePrices(
        chosen.map((item) => item.id),
        value,
      ),
    onSuccess: (count) => {
      notify("crm.pricing.bulk_done", {
        type: "success",
        messageArgs: { count },
      });
      queryClient.invalidateQueries();
      setOpen(false);
    },
    onError: () => notify("crm.pricing.save_failed", { type: "error" }),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Percent />
        {translate("crm.pricing.bulk")}
      </Button>
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{translate("crm.pricing.bulk")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{translate("crm.pricing.bulk_what")}</Label>
                <Select
                  value={category}
                  onValueChange={(next) => setCategory(String(next))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {category === ALL
                        ? translate("crm.pricing.bulk_all")
                        : category}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {translate("crm.pricing.bulk_all")}
                    </SelectItem>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-percent">
                  {translate("crm.pricing.bulk_percent")}
                </Label>
                <Input
                  id="bulk-percent"
                  inputMode="decimal"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {translate("crm.pricing.bulk_hint")}
            </p>
            {isValid ? (
              <ul className="max-h-60 divide-y overflow-y-auto rounded-md border text-sm">
                {chosen.map((item) => (
                  <li
                    key={String(item.id)}
                    className="flex justify-between gap-3 px-3 py-1.5"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMoney(item.price!, item.currency, locale)} →{" "}
                      <b className="font-semibold text-foreground">
                        {formatMoney(
                          changedPrice(item.price!, value),
                          item.currency,
                          locale,
                        )}
                      </b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-destructive">
                {translate("crm.pricing.bulk_invalid")}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {translate("ra.action.cancel")}
              </Button>
              <Button
                onClick={() => apply.mutate()}
                disabled={!isValid || chosen.length === 0 || apply.isPending}
              >
                {translate("crm.pricing.bulk_apply", {
                  smart_count: chosen.length,
                })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
