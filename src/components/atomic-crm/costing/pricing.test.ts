import { describe, expect, it } from "vitest";

import {
  effectiveRule,
  priceFromCost,
  roundPrice,
  suggestedPrice,
  type ProductPriceRule,
} from "./pricing";
import type { CostSettings } from "./types";

// 300.00 of fixed cost; 20% of the price goes to commission, tax and card fee
const cost = { fixedTotal: 30000, variablePercent: 20 };

/** What is left of a price after the whole cost. */
const profitAt = (price: number) =>
  price - cost.fixedTotal - (price * cost.variablePercent) / 100;

const settings = {
  service_price_method: "margin",
  service_price_value: 30,
  goods_price_method: "markup",
  goods_price_value: 50,
  price_rounding: "10",
} as CostSettings;

describe("priceFromCost", () => {
  it("keeps the margin as a share of the price", () => {
    const price = priceFromCost(cost, { method: "margin", value: 30 })!;
    expect(price).toBe(60000);
    expect(profitAt(price) / price).toBeCloseTo(0.3, 3);
  });

  it("keeps the markup of the full cost, percents of the price included", () => {
    const price = priceFromCost(cost, { method: "markup", value: 50 })!;
    const fullCost = price - profitAt(price);
    expect(profitAt(price) / fullCost).toBeCloseTo(0.5, 3);
  });

  it("keeps a fixed profit after the percents", () => {
    const price = priceFromCost(cost, { method: "profit", value: 10000 })!;
    expect(price).toBe(50000);
    expect(profitAt(price)).toBeCloseTo(10000, 0);
  });

  it("has no price when the percents eat it all", () => {
    expect(
      priceFromCost(
        { fixedTotal: 1000, variablePercent: 80 },
        { method: "margin", value: 30 },
      ),
    ).toBeNull();
  });
});

describe("roundPrice", () => {
  it("rounds up to a step of hryvnias", () => {
    expect(roundPrice(44_710, "10", 100)).toBe(45_000);
    expect(roundPrice(46_200, "50", 100)).toBe(50_000);
    expect(roundPrice(44_710, "1", 100)).toBe(44_800);
    expect(roundPrice(45_000, "100", 100)).toBe(50_000);
    expect(roundPrice(50_000, "100", 100)).toBe(50_000);
  });

  it("rounds up to a price ending in 9 or 99", () => {
    expect(roundPrice(44_700, "9", 100)).toBe(44_900);
    expect(roundPrice(44_900, "9", 100)).toBe(44_900);
    expect(roundPrice(45_000, "9", 100)).toBe(45_900);
    expect(roundPrice(124_700, "99", 100)).toBe(129_900);
  });

  it("leaves the price as it is without rounding", () => {
    expect(roundPrice(44_713, "none", 100)).toBe(44_713);
  });
});

describe("effectiveRule", () => {
  it("follows the business rule for services and for goods", () => {
    expect(effectiveRule(settings, "service").rule).toEqual({
      method: "margin",
      value: 30,
    });
    expect(effectiveRule(settings, "goods").rule).toEqual({
      method: "markup",
      value: 50,
    });
    expect(effectiveRule(settings, "goods").isOwn).toBe(false);
  });

  it("prefers a rule of the product's own", () => {
    const own = {
      id: 1,
      product_id: 7,
      method: "profit",
      value: 20000,
      rounding: "9",
    } as ProductPriceRule;
    expect(effectiveRule(settings, "service", own)).toEqual({
      rule: { method: "profit", value: 20000 },
      rounding: "9",
      isOwn: true,
    });
  });

  it("keeps the business rule for a product priced from the calculation only", () => {
    const linked = {
      id: 1,
      product_id: 7,
      method: null,
      value: null,
      rounding: null,
    } as ProductPriceRule;
    expect(effectiveRule(settings, "service", linked).isOwn).toBe(false);
  });
});

describe("suggestedPrice", () => {
  it("rounds the calculated price", () => {
    expect(suggestedPrice(cost, effectiveRule(settings, "service"), 100)).toBe(
      60000,
    );
    expect(
      suggestedPrice(
        { fixedTotal: 30010, variablePercent: 20 },
        effectiveRule(settings, "service"),
        100,
      ),
    ).toBe(61000);
  });
});
