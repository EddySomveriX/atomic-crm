import type { Identifier, RaRecord } from "ra-core";

import type { CostSettings } from "./types";

/**
 * A price formed from the cost, the way a finance person does it, and the
 * rounding of that price. Parts of the cost that are a percent of the price
 * (pay by commission, tax, card fee, own percents) grow with the price, so
 * every method solves for the price that keeps the chosen profit after them.
 * Amounts are in minor units of currency.
 */

export const PRICE_METHODS = ["margin", "markup", "profit"] as const;
/** margin: percent of the price; markup: percent of the cost; profit: an amount */
export type PriceMethod = (typeof PRICE_METHODS)[number];

export const ROUNDINGS = ["none", "1", "10", "50", "100", "9", "99"] as const;
/** Up to a step of currency units, or up to a price ending in 9 or 99 */
export type Rounding = (typeof ROUNDINGS)[number];

export interface PriceRule {
  method: PriceMethod;
  /** Percent for margin and markup, minor units for profit */
  value: number;
}

/** A rule of its own of a product (public.product_price_rules). */
export interface ProductPriceRule extends RaRecord {
  product_id: Identifier;
  method: PriceMethod | null;
  value: number | null;
  rounding: Rounding | null;
}

/** The two parts of a cost the price depends on (see computeCost). */
export interface CostShape {
  /** Parts that do not depend on the price */
  fixedTotal: number;
  /** Percents of the price, summed */
  variablePercent: number;
}

export interface EffectiveRule {
  rule: PriceRule;
  rounding: Rounding;
  /** The product has a rule of its own, not the business one */
  isOwn: boolean;
}

export const isPriceMethod = (value: unknown): value is PriceMethod =>
  (PRICE_METHODS as readonly unknown[]).includes(value);

export const isRounding = (value: unknown): value is Rounding =>
  (ROUNDINGS as readonly unknown[]).includes(value);

/** The rule of the business for services or for goods. */
export const businessRule = (
  settings: CostSettings,
  kind: string,
): PriceRule =>
  kind === "service"
    ? {
        method: settings.service_price_method,
        value: Number(settings.service_price_value),
      }
    : {
        method: settings.goods_price_method,
        value: Number(settings.goods_price_value),
      };

/** The rule a product follows: its own when it has one, else the business one. */
export const effectiveRule = (
  settings: CostSettings,
  kind: string,
  own?: ProductPriceRule | null,
): EffectiveRule => {
  const method = own?.method ?? null;
  const value = own?.value ?? null;
  const hasOwnRule = method != null && value != null;
  return {
    rule: hasOwnRule
      ? { method, value: Number(value) }
      : businessRule(settings, kind),
    rounding: own?.rounding ?? settings.price_rounding,
    isOwn: hasOwnRule || own?.rounding != null,
  };
};

/**
 * The lowest price that keeps the rule, before rounding; null when the
 * percents of the price leave nothing (they reach 100%).
 */
export const priceFromCost = (
  cost: CostShape,
  rule: PriceRule,
): number | null => {
  const percents = cost.variablePercent / 100;
  const value = Number(rule.value);
  let price: number | null = null;
  if (rule.method === "margin") {
    const share = percents + value / 100;
    price = share < 1 ? cost.fixedTotal / (1 - share) : null;
  } else if (rule.method === "markup") {
    // The profit is the markup of the full cost, percents of the price included
    const factor = 1 + value / 100;
    const left = 1 - percents * factor;
    price = left > 0 ? (cost.fixedTotal * factor) / left : null;
  } else {
    price = percents < 1 ? (cost.fixedTotal + value) / (1 - percents) : null;
  }
  return price == null || !Number.isFinite(price) ? null : Math.ceil(price);
};

/** Rounds a price up; minorPerUnit is 100 for a currency with kopiyky. */
export const roundPrice = (
  minor: number,
  rounding: Rounding,
  minorPerUnit: number,
): number => {
  if (rounding === "none") return minor;
  if (rounding === "9" || rounding === "99") {
    const step = rounding === "9" ? 10 : 100;
    const units = Math.ceil(minor / minorPerUnit);
    return (Math.ceil((units + 1) / step) * step - 1) * minorPerUnit;
  }
  const step = Number(rounding) * minorPerUnit;
  return Math.ceil(minor / step) * step;
};

/** The calculated price of a product, rounded; null when there is none. */
export const suggestedPrice = (
  cost: CostShape,
  { rule, rounding }: Pick<EffectiveRule, "rule" | "rounding">,
  minorPerUnit: number,
): number | null => {
  const price = priceFromCost(cost, rule);
  return price == null || price <= 0
    ? null
    : roundPrice(price, rounding, minorPerUnit);
};
