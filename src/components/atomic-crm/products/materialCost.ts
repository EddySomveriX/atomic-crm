import type { Identifier, RaRecord } from "ra-core";

import type { Product } from "./types";

/** A material one visit of a service uses (public.service_materials). */
export interface ServiceMaterial extends RaRecord {
  service_id: Identifier;
  material_id: Identifier;
  /** In the unit of the material */
  quantity: number;
}

/** "12,5" or "3" typed by a person → a quantity above 0 with up to 3 decimals. */
export const parseQuantity = (text: string): number | null => {
  const cleaned = text.trim().replace(",", ".");
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
};

/**
 * Cost of the materials of one visit in minor units, at the average purchase
 * cost of each material; null when a material has no cost yet.
 */
export const visitMaterialsCost = (
  materials: readonly ServiceMaterial[],
  products: readonly Pick<Product, "id" | "average_cost">[],
): number | null => {
  let total = 0;
  for (const item of materials) {
    const cost = products.find(
      (product) => product.id === item.material_id,
    )?.average_cost;
    if (cost == null) return null;
    total += Number(item.quantity) * cost;
  }
  return Math.round(total);
};
