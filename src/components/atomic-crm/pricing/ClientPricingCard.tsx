import {
  useGetList,
  useGetMany,
  useLocaleState,
  useNotify,
  useCanAccess,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";

import type { Product } from "../products/types";
import type { Company } from "../types";
import type { ClientPackage } from "./types";

/**
 * Prices of one client on their card: the personal discount (it counts as an
 * offer: the best one applies) and the packages they hold.
 */
export const ClientPricingCard = ({ client }: { client: Company }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [uiLocale = "uk"] = useLocaleState();
  const { canAccess: canEdit } = useCanAccess({
    resource: "companies",
    action: "edit",
  });
  const [update] = useUpdate();
  const [discount, setDiscount] = useState(
    client.personal_discount ? String(client.personal_discount) : "",
  );
  const { data: packages = [] } = useGetList<ClientPackage>("client_packages", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "expires_at", order: "DESC" },
    filter: { client_id: client.id, status: "active" },
  });
  const productIds = [...new Set(packages.map((item) => item.product_id))];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );

  const saveDiscount = () => {
    const value = discount.trim() === "" ? null : Number(discount);
    if (
      value != null &&
      (!Number.isInteger(value) || value < 1 || value > 90)
    ) {
      notify("crm.pricing.bulk_invalid", { type: "warning" });
      return;
    }
    if (value === (client.personal_discount ?? null)) return;
    update(
      "companies",
      {
        id: client.id,
        data: { personal_discount: value },
        previousData: client,
      },
      { onError: () => notify("crm.pricing.save_failed", { type: "error" }) },
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-muted-foreground">
          {translate("crm.pricing.personal_discount")}
        </span>
        <Input
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          onBlur={saveDiscount}
          inputMode="numeric"
          placeholder="—"
          disabled={!canEdit}
          className="h-8 w-20 text-right"
        />
      </label>
      {packages.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted-foreground">
            {translate("crm.pricing.packages_of_client")}
          </p>
          <ul className="text-sm">
            {packages.map((item) => (
              <li key={String(item.id)} className="flex justify-between gap-2">
                <span className="truncate">
                  {
                    products.find((product) => product.id === item.product_id)
                      ?.name
                  }
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {translate("crm.pricing.visits_left", {
                    left: item.visits_left,
                    total: item.visits_total,
                  })}
                  {" · "}
                  {translate("crm.pricing.until", {
                    date: new Date(item.expires_at).toLocaleDateString(
                      uiLocale,
                    ),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
