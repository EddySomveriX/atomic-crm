import { describe, expect, it } from "vitest";

import {
  parseQuantity,
  visitMaterialsCost,
  type ServiceMaterial,
} from "./materialCost";

const material = (material_id: number, quantity: number): ServiceMaterial => ({
  id: material_id,
  service_id: 1,
  material_id,
  quantity,
});

describe("parseQuantity", () => {
  it("reads quantities typed with a comma or a dot", () => {
    expect(parseQuantity("12,5")).toBe(12.5);
    expect(parseQuantity(" 3 ")).toBe(3);
    expect(parseQuantity("0.125")).toBe(0.125);
  });

  it("refuses zero, words and more than three decimals", () => {
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("1,2345")).toBeNull();
    expect(parseQuantity("-2")).toBeNull();
  });
});

describe("visitMaterialsCost", () => {
  it("adds up quantity times the average cost of each material", () => {
    // 50 ml at 3.00 and one pair of gloves at 10.00
    expect(
      visitMaterialsCost(
        [material(2, 50), material(3, 1)],
        [
          { id: 2, average_cost: 300 },
          { id: 3, average_cost: 1000 },
        ],
      ),
    ).toBe(16000);
  });

  it("is zero for a service without materials", () => {
    expect(visitMaterialsCost([], [])).toBe(0);
  });

  it("is unknown while a material was never bought", () => {
    expect(
      visitMaterialsCost([material(2, 50)], [{ id: 2, average_cost: null }]),
    ).toBeNull();
  });
});
