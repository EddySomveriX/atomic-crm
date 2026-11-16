import { Trash2 } from "lucide-react";
import {
  Form,
  useCanAccess,
  useCreate,
  useDelete,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatQuantity } from "./productOptions";
import {
  parseQuantity,
  visitMaterialsCost,
  type ServiceMaterial,
} from "./materialCost";
import type { Product } from "./types";

/**
 * The goods and materials one visit of a service uses: they are written off
 * the main warehouse when a visit is marked as done, and their cost shows
 * what is left of the price.
 */
export const ServiceMaterials = ({ service }: { service: Product }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [uiLocale = "uk"] = useLocaleState();
  const { locale } = useConfigurationContext();
  const money = (minor: number) => formatMoney(minor, service.currency, locale);
  const { canAccess: canEdit } = useCanAccess({
    resource: "service_materials",
    action: "edit",
  });
  const [remove] = useDelete();
  const { data: materials = [] } = useGetList<ServiceMaterial>(
    "service_materials",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
      filter: { service_id: service.id },
    },
  );
  const ids = materials.map((item) => item.material_id);
  // A list, not getMany: only lists and single reads carry stock and cost
  const { data: products = [] } = useGetList<Product>(
    "products",
    {
      pagination: { page: 1, perPage: 50 },
      filter: { "id@in": `(${ids.join(",")})` },
    },
    { enabled: ids.length > 0 },
  );
  const cost = visitMaterialsCost(materials, products);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {translate("crm.materials.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.materials.hint")}
          </p>
        </div>
        {materials.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-md border">
            {materials.map((item) => {
              const product = products.find(
                (candidate) => candidate.id === item.material_id,
              );
              const unit = product
                ? translate(`crm.units.${product.unit_code}`)
                : "";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/products/${item.material_id}/show`}
                      className="block truncate font-medium hover:underline"
                    >
                      {product?.name ?? "…"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {translate("crm.materials.in_stock", {
                        quantity: `${formatQuantity(product?.quantity, uiLocale)} ${unit}`,
                      })}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatQuantity(item.quantity, uiLocale)} {unit}
                  </span>
                  <span className="w-24 text-right tabular-nums text-muted-foreground">
                    {product?.average_cost != null
                      ? money(
                          Math.round(
                            Number(item.quantity) * product.average_cost,
                          ),
                        )
                      : "—"}
                  </span>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={translate("crm.materials.remove", {
                        name: product?.name ?? "",
                      })}
                      onClick={() =>
                        remove(
                          "service_materials",
                          { id: item.id, previousData: item },
                          {
                            onError: () =>
                              notify("crm.materials.failed", {
                                type: "error",
                              }),
                          },
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.materials.none")}
          </p>
        )}
        {materials.length > 0 ? (
          <p className="text-sm">
            {cost == null
              ? translate("crm.materials.cost_unknown")
              : service.price != null
                ? translate("crm.materials.cost_and_margin", {
                    cost: money(cost),
                    margin: money(service.price - cost),
                  })
                : translate("crm.materials.cost", { cost: money(cost) })}
          </p>
        ) : null}
        {canEdit ? (
          <AddMaterial serviceId={service.id} key={materials.length} />
        ) : null}
      </CardContent>
    </Card>
  );
};

const AddMaterial = ({ serviceId }: { serviceId: Identifier }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [quantity, setQuantity] = useState("");
  const parsed = parseQuantity(quantity);

  return (
    <Form
      resource="service_materials"
      onSubmit={(values: { material_id?: Identifier }) => {
        if (values.material_id == null || parsed == null) return;
        create(
          "service_materials",
          {
            data: {
              service_id: serviceId,
              material_id: values.material_id,
              quantity: parsed,
            },
          },
          {
            // The same material twice breaks the unique key
            onError: () => notify("crm.materials.failed", { type: "error" }),
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <ReferenceInput
            source="material_id"
            reference="products"
            filter={{ "kind@neq": "service", archived: false }}
          >
            <AutocompleteInput
              optionText="name"
              label="crm.materials.material"
              helperText={false}
            />
          </ReferenceInput>
        </div>
        <Input
          aria-label={translate("crm.materials.quantity")}
          placeholder={translate("crm.materials.quantity")}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="decimal"
          className="w-28"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={parsed == null || isPending}
        >
          {translate("ra.action.add")}
        </Button>
      </div>
    </Form>
  );
};
