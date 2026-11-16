import type { Product } from "../products/types";

export interface PriceGroup {
  /** null: products without a category */
  category: string | null;
  products: Product[];
}

/**
 * Products grouped by category for the price list: categories in alphabetical
 * order with the uncategorised last, products by their order and name.
 */
export const groupByCategory = (
  products: Product[],
  locale = "uk",
): PriceGroup[] => {
  const groups = new Map<string | null, Product[]>();
  for (const product of products) {
    const key = product.category?.trim() || null;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a == null ? 1 : b == null ? -1 : a.localeCompare(b, locale),
    )
    .map(([category, items]) => ({
      category,
      products: [...items].sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name, locale),
      ),
    }));
};

/**
 * The new price after a change by a percent, rounded to whole units of money
 * like the database does (public.change_prices).
 */
export const changedPrice = (minor: number, percent: number): number =>
  Math.round((minor * (100 + percent)) / 100 / 100) * 100;

/** "650" or "650,50" typed by a person → minor units; null when unreadable. */
export const parsePrice = (text: string): number | null => {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};
