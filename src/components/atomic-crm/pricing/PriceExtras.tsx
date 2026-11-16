import {
  useCreate,
  useDelete,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { specialistName } from "../booking/types";
import { useSpecialists } from "../booking/useBookingData";
import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { parsePrice } from "./priceList";
import type { PriceChange, SpecialistPrice } from "./types";

/**
 * More about one price: the own prices of specialists for a service (empty:
 * the list price) and the history of its changes.
 */
export const PriceExtras = ({
  product,
  canEdit,
}: {
  product: Product;
  canEdit: boolean;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={translate("crm.pricing.more")}
            title={translate("crm.pricing.more")}
          />
        }
      >
        <History className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {open ? (
          <div className="flex flex-col gap-4">
            {product.kind === "service" ? (
              <SpecialistPrices product={product} canEdit={canEdit} />
            ) : null}
            <PriceHistory product={product} />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

const SpecialistPrices = ({
  product,
  canEdit,
}: {
  product: Product;
  canEdit: boolean;
}) => {
  const translate = useTranslate();
  const { specialists } = useSpecialists();
  const { data: prices = [] } = useGetList<SpecialistPrice>(
    "specialist_prices",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: { product_id: product.id },
    },
  );
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-semibold">
        {translate("crm.pricing.specialist_prices")}
      </p>
      <p className="text-xs text-muted-foreground">
        {translate("crm.pricing.specialist_prices_hint")}
      </p>
      {specialists.map((person) => (
        <SpecialistPriceRow
          key={String(person.id)}
          name={specialistName(person)}
          product={product}
          salesId={person.id}
          current={prices.find((item) => item.sales_id === person.id)}
          canEdit={canEdit}
        />
      ))}
    </section>
  );
};

const SpecialistPriceRow = ({
  name,
  product,
  salesId,
  current,
  canEdit,
}: {
  name: string;
  product: Product;
  salesId: SpecialistPrice["sales_id"];
  current: SpecialistPrice | undefined;
  canEdit: boolean;
}) => {
  const notify = useNotify();
  const [text, setText] = useState(current ? String(current.price / 100) : "");
  const [create] = useCreate();
  const [update] = useUpdate();
  const [remove] = useDelete();
  const onError = () => notify("crm.pricing.save_failed", { type: "error" });

  const save = () => {
    if (text.trim() === "") {
      if (current) {
        remove(
          "specialist_prices",
          { id: current.id, previousData: current },
          { onError },
        );
      }
      return;
    }
    const price = parsePrice(text);
    if (price == null)
      return notify("crm.pricing.price_invalid", { type: "warning" });
    if (current) {
      if (price !== current.price) {
        update(
          "specialist_prices",
          { id: current.id, data: { price }, previousData: current },
          { onError },
        );
      }
    } else {
      create(
        "specialist_prices",
        { data: { product_id: product.id, sales_id: salesId, price } },
        { onError },
      );
    }
  };

  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate">{name}</span>
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
        inputMode="decimal"
        placeholder={product.price == null ? "—" : String(product.price / 100)}
        disabled={!canEdit}
        className="h-8 w-24 text-right"
      />
    </label>
  );
};

const PriceHistory = ({ product }: { product: Product }) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { locale } = useConfigurationContext();
  const { data: changes = [] } = useGetList<PriceChange>("price_history", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "changed_at", order: "DESC" },
    filter: { product_id: product.id },
  });
  const money = (minor: number | null) =>
    minor == null ? "—" : formatMoney(minor, product.currency, locale);
  return (
    <section className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold">
        {translate("crm.pricing.history")}
      </p>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate("crm.pricing.no_history")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {changes.map((change) => (
            <li key={String(change.id)} className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {new Date(change.changed_at).toLocaleDateString(uiLocale)}
              </span>
              <span className="tabular-nums">
                {money(change.old_price)} → {money(change.new_price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
