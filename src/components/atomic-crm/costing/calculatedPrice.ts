import type { ServiceMaterial } from "../products/materialCost";
import type { Product } from "../products/types";
import { computeCost, type CostResult } from "./costCalc";
import {
  effectiveRule,
  suggestedPrice,
  type EffectiveRule,
  type ProductPriceRule,
} from "./pricing";
import type { CostInputs, ProductCostItem } from "./types";

export interface CalculatedPrice {
  product: Product;
  /** The cost at the list price */
  cost: CostResult;
  effective: EffectiveRule;
  /** The rule row of the product: it is priced from the calculation */
  own: ProductPriceRule | null;
  /** The calculated, rounded price; null without one */
  suggested: number | null;
}

export interface CostData {
  inputs: CostInputs;
  products: Product[];
  materials: ServiceMaterial[];
  items: ProductCostItem[];
  rules: ProductPriceRule[];
}

/**
 * The calculated price of one service or goods, by its rule; the same sum
 * for the calculator, the bulk update and the price list.
 */
export const calculatedPriceOf = (
  product: Product,
  data: CostData,
  minorPerUnit: number,
  /** A rule being tried in the calculator instead of the saved one */
  trial?: Pick<EffectiveRule, "rule" | "rounding">,
): CalculatedPrice => {
  const own =
    data.rules.find((rule) => String(rule.product_id) === String(product.id)) ??
    null;
  const cost = computeCost({
    product,
    materials: data.materials.filter((item) => item.service_id === product.id),
    stock: data.products,
    items: data.items.filter((item) => item.product_id === product.id),
    inputs: data.inputs,
  });
  const saved = effectiveRule(data.inputs.settings, product.kind, own);
  const effective = trial ? { ...saved, ...trial } : saved;
  return {
    product,
    cost,
    effective,
    own,
    suggested: cost.isIncomplete
      ? null
      : suggestedPrice(cost, effective, minorPerUnit),
  };
};

/** Products the price list sells: everything but materials. */
export const isPriced = (product: Product) => product.kind !== "material";
