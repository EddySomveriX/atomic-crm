import type { CostData } from "./calculatedPrice";
import { useCostData } from "./useCostData";

/** The cost data for the price list, or null for those who may not see costs. */
export const usePriceListCosts = (): CostData | null => {
  const { canRead, inputs, products, materials, items, rules } = useCostData();
  return canRead && inputs
    ? { inputs, products, materials, items, rules }
    : null;
};
