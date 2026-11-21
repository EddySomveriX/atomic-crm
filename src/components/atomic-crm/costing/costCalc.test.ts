import { describe, expect, it } from "vitest";

import { computeCost, minuteCost, unitCost } from "./costCalc";
import { suggestedPrice } from "./pricing";
import type { CostInputs, ProductCostItem } from "./types";
import { parseAmount } from "./useCostData";

const inputs = (
  overrides: Partial<CostInputs["settings"]> = {},
): CostInputs => ({
  settings: {
    load_percent: 80,
    pay_mode: "commission",
    hourly_rate: null,
    tax_percent: 5,
    card_fee_percent: 1.5,
    card_share_percent: 60,
    service_price_method: "margin",
    service_price_value: 30,
    goods_price_method: "markup",
    goods_price_value: 50,
    price_rounding: "none",
    material_price: "average",
    ...overrides,
  },
  // 3 000.00 a month over 2 080 working minutes at 80% load
  overhead_monthly: 300000,
  working_minutes_month: 2080,
  commission_percent: 40,
  last_costs: { "2": 400 },
  income_taxes: [],
});

// A colouring: 800.00, 60 minutes and a 15-minute pause, 50 ml of dye
const service = {
  id: 1,
  kind: "service" as const,
  price: 80000,
  duration_minutes: 60,
  buffer_minutes: 15,
  average_cost: null,
};
const dye = { id: 2, average_cost: 300 };
const towel: ProductCostItem = {
  id: 1,
  product_id: 1,
  name: "Towel",
  amount: 500,
  percent: null,
};
const materials = [{ id: 1, service_id: 1, material_id: 2, quantity: 50 }];

describe("computeCost for a service", () => {
  const result = computeCost({
    product: service,
    materials,
    stock: [dye],
    items: [towel],
    inputs: inputs(),
  });

  it("adds materials, pay, a share of the expenses by minutes, tax, card fee and own lines", () => {
    expect(result.lines).toEqual([
      { key: "materials", amount: 15000 },
      { key: "overhead", amount: 13522 },
      { key: "own", name: "Towel", amount: 500 },
      { key: "pay", amount: 32000 },
      { key: "tax", amount: 4000 },
      { key: "card_fee", amount: 720 },
    ]);
    expect(result.total).toBe(65742);
  });

  it("tells the profit, margin, markup and profit per hour", () => {
    expect(result.profit).toBe(14258);
    expect(result.marginPercent).toBe(17.8);
    expect(result.markupPercent).toBe(21.7);
    expect(result.profitPerHour).toBe(11406);
  });

  it("finds the break-even price, the price for the target margin and the visits a month", () => {
    expect(result.breakEvenPrice).toBe(53645);
    expect(
      suggestedPrice(
        result,
        { rule: { method: "margin", value: 30 }, rounding: "none" },
        100,
      ),
    ).toBe(120422);
    expect(result.breakEvenVisits).toBe(11);
  });

  it("tries another price", () => {
    const cheaper = computeCost({
      product: service,
      price: 50000,
      materials,
      stock: [dye],
      items: [towel],
      inputs: inputs(),
    });
    expect(cheaper.profit).toBeLessThan(0);
  });

  it("pays by the hour when asked", () => {
    const hourly = computeCost({
      product: service,
      materials: [],
      stock: [],
      items: [],
      inputs: inputs({ pay_mode: "hourly", hourly_rate: 20000 }),
    });
    expect(hourly.lines.find((line) => line.key === "pay")?.amount).toBe(20000);
  });

  it("is incomplete while a material was never bought", () => {
    const unknown = computeCost({
      product: service,
      materials,
      stock: [{ id: 2, average_cost: null }],
      items: [],
      inputs: { ...inputs(), last_costs: {} },
    });
    expect(unknown.isIncomplete).toBe(true);
  });
});

describe("computeCost for goods", () => {
  it("counts the purchase cost and no share of the expenses", () => {
    const result = computeCost({
      product: {
        id: 2,
        kind: "goods",
        price: 1000,
        duration_minutes: null,
        buffer_minutes: 0,
        average_cost: 300,
      },
      materials: [],
      stock: [],
      items: [],
      inputs: inputs({ tax_percent: 0, card_fee_percent: 0 }),
    });
    expect(result.lines).toEqual([{ key: "purchase", amount: 300 }]);
    expect(result.profit).toBe(700);
    expect(result.breakEvenVisits).toBeNull();
  });
});

describe("parseAmount", () => {
  it("reads amounts with spaces and a comma", () => {
    expect(parseAmount("1 250,50")).toBe(125050);
    expect(parseAmount("1 250")).toBe(125000);
  });

  it("refuses words and negative amounts", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("unitCost and minuteCost", () => {
  it("uses the last purchase cost when asked", () => {
    expect(unitCost(dye, inputs())).toBe(300);
    expect(unitCost(dye, inputs({ material_price: "last" }))).toBe(400);
  });

  it("has no minute cost without working hours", () => {
    expect(minuteCost({ ...inputs(), working_minutes_month: 0 })).toBeNull();
  });
});
