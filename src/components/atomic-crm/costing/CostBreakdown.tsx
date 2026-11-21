import { Trash2 } from "lucide-react";
import {
  useCanAccess,
  useCreate,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { formatMoney, getMinorDigits } from "../money/money";
import type { ServiceMaterial } from "../products/materialCost";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { parsePercent } from "../team/types";
import type { CostData } from "./calculatedPrice";
import { computeCost, type CostLine } from "./costCalc";
import { PriceCalculator } from "./PriceCalculator";
import type { CostInputs, ProductCostItem } from "./types";
import { formatPercent, parseAmount } from "./useCostData";
import { useUndoableDelete } from "../misc/useUndoableDelete";

/** The lines of the cost of one product, its price calculator, a price to try and lines of its own. */
export const CostBreakdown = ({
  product,
  inputs,
  materials,
  stock,
  items,
  data,
}: {
  product: Product;
  inputs: CostInputs;
  materials: ServiceMaterial[];
  stock: Product[];
  items: ProductCostItem[];
  /** Everything the cost page loaded, for the price calculator */
  data: CostData;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const digits = getMinorDigits(currency);
  const money = (minor: number | null) =>
    minor == null ? "—" : formatMoney(minor, currency, locale);
  const [tryPrice, setTryPrice] = useState("");
  const tried = parseAmount(tryPrice, digits);
  const result = computeCost({
    product,
    price: tried ?? undefined,
    materials,
    stock,
    items,
    inputs,
  });
  const isService = product.kind === "service";

  const lineLabel = (line: CostLine) =>
    line.key === "own"
      ? (line.name ?? "")
      : translate(`crm.costing.lines.${line.key}`);

  return (
    <div className="flex flex-col gap-4 border-t bg-muted/30 px-3 py-3 text-sm">
      <dl className="flex flex-col gap-1">
        {result.lines.map((line, index) => (
          <div key={`${line.key}-${index}`} className="flex justify-between">
            <dt className="text-muted-foreground">{lineLabel(line)}</dt>
            <dd className="tabular-nums">{money(line.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t pt-1 font-medium">
          <dt>{translate("crm.costing.total")}</dt>
          <dd className="tabular-nums">{money(result.total)}</dd>
        </div>
      </dl>
      {result.isIncomplete ? (
        <p className="text-muted-foreground">
          {translate("crm.costing.incomplete")}
        </p>
      ) : null}
      {isService ? (
        <Link
          to={`/products/${product.id}/show`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {translate("crm.costing.edit_materials")}
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure label={translate("crm.costing.profit")}>
          <span
            className={cn(
              result.profit != null && result.profit < 0 && "text-destructive",
            )}
          >
            {money(result.profit)}
          </span>
        </Figure>
        <Figure label={translate("crm.costing.margin")}>
          {formatPercent(result.marginPercent, locale)}
        </Figure>
        <Figure label={translate("crm.costing.markup")}>
          {formatPercent(result.markupPercent, locale)}
        </Figure>
        <Figure label={translate("crm.costing.break_even_price")}>
          {money(result.breakEvenPrice)}
        </Figure>
        {isService ? (
          <Figure label={translate("crm.costing.break_even_visits")}>
            {result.breakEvenVisits ?? "—"}
          </Figure>
        ) : null}
      </div>

      <PriceCalculator product={product} data={data} money={money} />

      <label className="flex flex-wrap items-center gap-2">
        <span>{translate("crm.costing.try_price")}</span>
        <Input
          value={tryPrice}
          onChange={(event) => setTryPrice(event.target.value)}
          inputMode="decimal"
          placeholder={
            product.price != null
              ? String(product.price / 10 ** digits)
              : undefined
          }
          className="h-9 w-32 text-right"
        />
        <span className="text-muted-foreground">{currency}</span>
      </label>

      <OwnLines productId={product.id} items={items} money={money} />
    </div>
  );
};

const Figure = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{children}</span>
  </div>
);

const OwnLines = ({
  productId,
  items,
  money,
}: {
  productId: Product["id"];
  items: ProductCostItem[];
  money: (minor: number | null) => string;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { currency } = useConfigurationContext();
  const { canAccess: canEdit } = useCanAccess({
    resource: "product_cost_items",
    action: "edit",
  });
  const [create, { isPending }] = useCreate();
  const deleteWithUndo = useUndoableDelete();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [isPercent, setIsPercent] = useState(false);
  const amount = isPercent
    ? null
    : parseAmount(value, getMinorDigits(currency));
  const percent = isPercent ? parsePercent(value) : null;
  const isValid =
    name.trim() !== "" &&
    (isPercent ? percent != null && percent < 100 : amount != null);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium">{translate("crm.costing.own.title")}</span>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="tabular-nums">
                {item.percent != null
                  ? `${Number(item.percent)}%`
                  : money(item.amount)}
              </span>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={translate("crm.costing.remove", {
                    name: item.name,
                  })}
                  onClick={() =>
                    deleteWithUndo("product_cost_items", item, {
                      errorMessage: "crm.costing.failed",
                    })
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          {translate("crm.costing.own.hint")}
        </p>
      )}
      {canEdit ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValid) return;
            create(
              "product_cost_items",
              {
                data: {
                  product_id: productId,
                  name: name.trim(),
                  amount,
                  percent,
                },
              },
              {
                onSuccess: () => {
                  setName("");
                  setValue("");
                },
                onError: () => notify("crm.costing.failed", { type: "error" }),
              },
            );
          }}
        >
          <Input
            aria-label={translate("crm.costing.own.name")}
            placeholder={translate("crm.costing.own.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 min-w-40 flex-1"
          />
          <Input
            aria-label={translate("crm.costing.own.value")}
            placeholder={isPercent ? "%" : currency}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            className="h-9 w-24 text-right"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isPercent}
            onClick={() => setIsPercent(!isPercent)}
          >
            {isPercent ? "%" : currency}
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!isValid || isPending}
          >
            {translate("ra.action.add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
};
