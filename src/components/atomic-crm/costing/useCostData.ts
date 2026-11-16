import { useQuery } from "@tanstack/react-query";
import { useCanAccess, useDataProvider, useGetList } from "ra-core";

import type { ServiceMaterial } from "../products/materialCost";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import type { ProductCostItem } from "./types";

const ALL = { page: 1, perPage: 1000 } as const;

/** Everything the cost of products needs, loaded once for the whole page. */
export const useCostData = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { canAccess: canRead } = useCanAccess({
    resource: "costs",
    action: "list",
  });
  const isOn = enabled && canRead === true;

  const inputs = useQuery({
    queryKey: ["cost_inputs"],
    queryFn: () => dataProvider.getCostInputs(),
    enabled: isOn,
  });
  const products = useGetList<Product>(
    "products",
    {
      pagination: ALL,
      sort: { field: "name", order: "ASC" },
      filter: { archived: false },
    },
    { enabled: isOn },
  );
  const materials = useGetList<ServiceMaterial>(
    "service_materials",
    { pagination: ALL, sort: { field: "id", order: "ASC" } },
    { enabled: isOn },
  );
  const items = useGetList<ProductCostItem>(
    "product_cost_items",
    { pagination: ALL, sort: { field: "id", order: "ASC" } },
    { enabled: isOn },
  );

  return {
    canRead: canRead === true,
    inputs: inputs.data,
    products: products.data ?? [],
    materials: materials.data ?? [],
    items: items.data ?? [],
    isPending:
      isOn &&
      (inputs.isPending ||
        products.isPending ||
        materials.isPending ||
        items.isPending),
    error: inputs.error,
  };
};

/** "1250,50" typed by a person, spaces allowed: minor units; null when empty or wrong. */
export const parseAmount = (text: string, minorDigits = 2): number | null => {
  // \s also matches the non-breaking space of formatted numbers
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 10 ** minorDigits);
};

/** 54.1 → "54,1%" in Ukrainian, "54.1%" in English; "—" when unknown. */
export const formatPercent = (value: number | null, locale: string): string =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
