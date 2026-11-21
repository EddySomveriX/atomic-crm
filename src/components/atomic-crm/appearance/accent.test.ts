import { describe, expect, it } from "vitest";

import { ACCENTS, accentVariables, isAccentKey } from "./accent";

/** WCAG relative luminance of a "#rrggbb" color. */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** Backgrounds of index.css: the light page and the dark page */
const LIGHT_PAGE = "#f6f7f8";
const DARK_PAGE = "#121614";
const DARK_TEXT = "#0b0f0d";
const AA = 4.5;

describe("personal accent colors", () => {
  it("offers ten colors and no red, which means errors", () => {
    expect(Object.keys(ACCENTS)).toHaveLength(10);
    expect(Object.keys(ACCENTS)).not.toContain("red");
  });

  it.each(Object.entries(ACCENTS))(
    "keeps %s readable in the light and the dark theme",
    (_, color) => {
      expect(contrast("#ffffff", color.light)).toBeGreaterThanOrEqual(AA);
      expect(contrast(color.light, LIGHT_PAGE)).toBeGreaterThanOrEqual(AA);
      expect(contrast(DARK_TEXT, color.dark)).toBeGreaterThanOrEqual(AA);
      expect(contrast(color.dark, DARK_PAGE)).toBeGreaterThanOrEqual(AA);
    },
  );

  it("colors the page tokens and the menu from one choice", () => {
    const variables = accentVariables("blue");
    expect(variables["--brand"]).toBe("#2563eb");
    expect(variables["--brand-dark"]).toBe("#7aa7ff");
    expect(variables["--sidebar"]).toContain("#2563eb");
    expect(variables["--sidebar-primary"]).toBe("#7aa7ff");
  });

  it("recognizes only the offered colors", () => {
    expect(isAccentKey("plum")).toBe(true);
    expect(isAccentKey("red")).toBe(false);
    expect(isAccentKey(null)).toBe(false);
  });
});
