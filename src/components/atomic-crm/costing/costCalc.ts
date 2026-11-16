import type { ServiceMaterial } from "../products/materialCost";
import type { Product } from "../products/types";
import type { CostInputs, ProductCostItem } from "./types";

/**
 * Full cost of one service or one unit of goods. Expenses of the month are
 * spread over the minutes the team actually works (time-driven
 * activity-based costing): a service carries the cost of its minutes and
 * its pause. Goods carry their purchase cost and no share of the expenses:
 * their result is what they contribute towards them.
 * Every amount is in minor units of currency.
 */

export type CostLineKey =
  "purchase" | "materials" | "pay" | "overhead" | "tax" | "card_fee" | "own";

export interface CostLine {
  key: CostLineKey;
  /** Name of a line of its own */
  name?: string;
  amount: number;
}

export interface CostResult {
  price: number | null;
  lines: CostLine[];
  total: number;
  /** A material or the goods have no purchase cost yet */
  isIncomplete: boolean;
  profit: number | null;
  marginPercent: number | null;
  markupPercent: number | null;
  /** Profit of an hour of a specialist's time (services) */
  profitPerHour: number | null;
  /** Lowest price that covers the cost */
  breakEvenPrice: number | null;
  /** Price that leaves the target margin */
  recommendedPrice: number | null;
  /** Visits a month that pay the expenses of the month (services) */
  breakEvenVisits: number | null;
}

export type CostedProduct = Pick<
  Product,
  | "id"
  | "kind"
  | "price"
  | "duration_minutes"
  | "buffer_minutes"
  | "average_cost"
>;

/** Purchase cost of one unit at the chosen price: average or last purchase. */
export const unitCost = (
  product: Pick<Product, "id" | "average_cost"> | undefined,
  inputs: CostInputs,
): number | null => {
  if (!product) return null;
  const last = inputs.last_costs[String(product.id)];
  if (inputs.settings.material_price === "last" && last != null) return last;
  return product.average_cost ?? last ?? null;
};

/** Cost of one minute of work: the expenses of the month over its booked minutes. */
export const minuteCost = (inputs: CostInputs): number | null => {
  const minutes =
    (inputs.working_minutes_month * inputs.settings.load_percent) / 100;
  return minutes > 0 ? inputs.overhead_monthly / minutes : null;
};

const percentOf = (value: number, percent: number): number =>
  (value * percent) / 100;

export const computeCost = ({
  product,
  price: priceOverride,
  materials,
  stock,
  items,
  inputs,
}: {
  product: CostedProduct;
  /** A price to try instead of the list price */
  price?: number | null;
  /** Materials of a service */
  materials: readonly ServiceMaterial[];
  /** Goods and materials with their average cost */
  stock: readonly Pick<Product, "id" | "average_cost">[];
  /** Lines of its own of this product */
  items: readonly ProductCostItem[];
  inputs: CostInputs;
}): CostResult => {
  const { settings } = inputs;
  const price = priceOverride !== undefined ? priceOverride : product.price;
  const isService = product.kind === "service";
  const minutes = isService
    ? (product.duration_minutes ?? 0) + (product.buffer_minutes ?? 0)
    : 0;
  let isIncomplete = false;

  // Parts that do not depend on the price…
  const fixed: CostLine[] = [];
  if (isService) {
    let materialsCost = 0;
    for (const item of materials) {
      const cost = unitCost(
        stock.find((candidate) => candidate.id === item.material_id),
        inputs,
      );
      if (cost == null) isIncomplete = true;
      materialsCost += Number(item.quantity) * (cost ?? 0);
    }
    if (materials.length > 0) {
      fixed.push({ key: "materials", amount: materialsCost });
    }
    if (settings.pay_mode === "hourly" && settings.hourly_rate != null) {
      fixed.push({
        key: "pay",
        amount: (settings.hourly_rate * (product.duration_minutes ?? 0)) / 60,
      });
    }
    const perMinute = minuteCost(inputs);
    if (perMinute != null && minutes > 0) {
      fixed.push({ key: "overhead", amount: perMinute * minutes });
    }
  } else {
    const cost = unitCost(product, inputs);
    if (cost == null) isIncomplete = true;
    fixed.push({ key: "purchase", amount: cost ?? 0 });
  }
  const ownFixed = items.filter((item) => item.amount != null);
  for (const item of ownFixed) {
    fixed.push({ key: "own", name: item.name, amount: Number(item.amount) });
  }

  // …and percents of the price
  const payPercent =
    isService && settings.pay_mode === "commission"
      ? Number(inputs.commission_percent ?? 0)
      : 0;
  const cardPercent = percentOf(
    Number(settings.card_fee_percent),
    Number(settings.card_share_percent),
  );
  const ownPercents = items.filter((item) => item.percent != null);
  const variablePercent =
    payPercent +
    Number(settings.tax_percent) +
    cardPercent +
    ownPercents.reduce((sum, item) => sum + Number(item.percent), 0);

  const base = price ?? 0;
  const variable: CostLine[] = [];
  if (payPercent > 0) {
    variable.push({ key: "pay", amount: percentOf(base, payPercent) });
  }
  if (Number(settings.tax_percent) > 0) {
    variable.push({
      key: "tax",
      amount: percentOf(base, Number(settings.tax_percent)),
    });
  }
  if (cardPercent > 0) {
    variable.push({ key: "card_fee", amount: percentOf(base, cardPercent) });
  }
  for (const item of ownPercents) {
    variable.push({
      key: "own",
      name: item.name,
      amount: percentOf(base, Number(item.percent)),
    });
  }

  const lines = [...fixed, ...variable].map((line) => ({
    ...line,
    amount: Math.round(line.amount),
  }));
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const fixedTotal = fixed.reduce((sum, line) => sum + line.amount, 0);
  const overhead = fixed.find((line) => line.key === "overhead")?.amount ?? 0;

  const priceFor = (share: number): number | null =>
    share < 100 ? Math.ceil(fixedTotal / (1 - share / 100)) : null;

  const profit = price == null ? null : price - total;
  // What a visit leaves before the expenses of the month
  const contribution =
    price == null ? null : price - (total - Math.round(overhead));

  return {
    price,
    lines,
    total,
    isIncomplete,
    profit,
    marginPercent:
      profit != null && price ? Math.round((profit / price) * 1000) / 10 : null,
    markupPercent:
      profit != null && total > 0
        ? Math.round((profit / total) * 1000) / 10
        : null,
    profitPerHour:
      profit != null && minutes > 0
        ? Math.round((profit * 60) / minutes)
        : null,
    breakEvenPrice: priceFor(variablePercent),
    recommendedPrice: priceFor(
      variablePercent + Number(settings.target_margin_percent),
    ),
    breakEvenVisits:
      isService && contribution != null && contribution > 0
        ? Math.ceil(inputs.overhead_monthly / contribution)
        : null,
  };
};
