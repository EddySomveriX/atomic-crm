import {
  useGetList,
  useNotify,
  usePermissions,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { BulkPriceChange } from "./BulkPriceChange";
import { PriceExtras } from "./PriceExtras";
import { groupByCategory, parsePrice } from "./priceList";
import { LoadingRows } from "../misc/PageStates";
import { Tag } from "lucide-react";
import { EmptyState } from "../misc/PageStates";

/**
 * The price list (the "Ціни" tab): services and goods by category. A click
 * on a price turns it into a field: Enter saves, Escape cancels. The bot,
 * the website and the calendar use the new price at once; bookings already
 * made keep theirs.
 */
export const PriceListTab = () => {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const canEdit = permissions !== "accountant";
  const { data: products = [], isPending } = useGetList<Product>("products", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
    filter: { archived: false },
  });
  const groups = groupByCategory(products);

  if (isPending) return <LoadingRows />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {translate("crm.pricing.list_hint")}
        </p>
        {canEdit ? <BulkPriceChange products={products} /> : null}
        <Link to="/products/create" className={buttonVariants()}>
          <Plus />
          {translate("crm.pricing.new_item")}
        </Link>
      </div>
      {groups.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={translate("crm.pricing.empty_title")}
          text={translate("crm.pricing.empty")}
        />
      ) : null}
      {groups.map((group) => (
        <section key={group.category ?? ""} className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {group.category ?? translate("crm.pricing.no_category")}
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {group.products.map((product) => (
              <PriceRow
                key={String(product.id)}
                product={product}
                canEdit={canEdit}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const PriceRow = ({
  product,
  canEdit,
}: {
  product: Product;
  canEdit: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { locale } = useConfigurationContext();
  const [update] = useUpdate<Product>();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const save = (data: Partial<Product>) =>
    update(
      "products",
      { id: product.id, data, previousData: product },
      {
        mutationMode: "optimistic",
        onError: () => notify("crm.pricing.save_failed", { type: "error" }),
      },
    );

  const startEdit = () => {
    if (!canEdit) return;
    setText(product.price == null ? "" : String(product.price / 100));
    setEditing(true);
  };
  const finishEdit = () => {
    setEditing(false);
    const price = text.trim() === "" ? null : parsePrice(text);
    if (text.trim() !== "" && price == null) {
      notify("crm.pricing.price_invalid", { type: "warning" });
      return;
    }
    if (price !== product.price) save({ price });
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") finishEdit();
    if (event.key === "Escape") setEditing(false);
  };

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
      <Link
        to={`/products/${product.id}/show`}
        className="min-w-0 flex-1 truncate no-underline hover:underline"
      >
        <span className="font-medium text-foreground">
          {product.is_addon ? "+ " : ""}
          {product.name}
        </span>
      </Link>
      {product.duration_minutes ? (
        <span className="w-16 text-sm text-muted-foreground tabular-nums">
          {translate("crm.booking.minutes", {
            count: product.duration_minutes,
          })}
        </span>
      ) : (
        <span className="w-16" />
      )}
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={finishEdit}
          onKeyDown={onKey}
          aria-label={translate("resources.products.fields.price")}
          className="w-28 rounded-md border-2 border-primary bg-background px-2 py-1 text-right tabular-nums outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          disabled={!canEdit}
          title={canEdit ? translate("crm.pricing.click_to_edit") : undefined}
          className={cn(
            "w-28 rounded-md px-2 py-1 text-right font-medium tabular-nums",
            canEdit && "hover:bg-muted",
          )}
        >
          {product.price == null
            ? "—"
            : formatMoney(product.price, product.currency, locale)}
        </button>
      )}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={product.show_online !== false}
          onCheckedChange={(checked) => save({ show_online: checked })}
          disabled={!canEdit}
          aria-label={translate("crm.pricing.online")}
        />
        <span className="hidden sm:inline">
          {translate("crm.pricing.online")}
        </span>
      </label>
      <PriceExtras product={product} canEdit={canEdit} />
    </li>
  );
};
