import { describe, expect, it } from "vitest";

import { SLUG_PATTERN, slugFrom } from "./pageSettings";

describe("slugFrom", () => {
  it("turns a Ukrainian name into a latin address", () => {
    expect(slugFrom("Київська студія")).toBe("kyivska-studiia");
    expect(slugFrom("Ярема Їжак")).toBe("yarema-yizhak");
    expect(slugFrom("Салон «Шик» №1")).toBe("salon-shyk-1");
  });

  it("always gives an address the database accepts", () => {
    for (const name of ["Я", "!!!", "Beauty   Bar", "x".repeat(80)]) {
      expect(SLUG_PATTERN.test(slugFrom(name))).toBe(true);
    }
  });
});
