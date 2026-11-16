import { describe, expect, it } from "vitest";

import type { Product } from "../products/types";
import { changedPrice, groupByCategory, parsePrice } from "./priceList";

const product = (
  id: number,
  name: string,
  category: string | null,
  sort_order = 0,
): Product => ({
  id,
  name,
  category,
  sort_order,
  kind: "service",
  sku: null,
  unit_code: "service",
  price: 10000,
  currency: "UAH",
  vat_rate_code: null,
  barcodes: [],
  description: null,
  archived: false,
});

describe("price list", () => {
  it("groups by category, uncategorised last, then by order and name", () => {
    const groups = groupByCategory([
      product(1, "Укладка", null),
      product(2, "Стрижка чоловіча", "Стрижки"),
      product(3, "Манікюр", "Манікюр"),
      product(4, "Стрижка жіноча", "Стрижки"),
      product(5, "Дитяча стрижка", "Стрижки", 9),
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "Манікюр",
      "Стрижки",
      null,
    ]);
    expect(groups[1].products.map((item) => item.name)).toEqual([
      "Стрижка жіноча",
      "Стрижка чоловіча",
      "Дитяча стрижка",
    ]);
  });

  it("changes a price by a percent and rounds it to whole money", () => {
    expect(changedPrice(65000, 10)).toBe(71500);
    expect(changedPrice(39900, 5)).toBe(41900);
    expect(changedPrice(50000, -15)).toBe(42500);
  });

  it("reads a typed price in hryvnias", () => {
    expect(parsePrice("650")).toBe(65000);
    expect(parsePrice("1 250,50")).toBe(125050);
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
  });
});
