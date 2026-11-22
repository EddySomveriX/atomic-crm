import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  PRESETS,
  READY_THEMES,
  THEME_PARTS,
  brandColors,
  themeCss,
  themeOf,
  themeVariables,
  type ThemeMode,
} from "./theme";
import { ACCENTS, type MenuPreset, type TextPreset } from "./themePresets";

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

const AA = 4.5;
const MODES: ThemeMode[] = ["light", "dark"];

/** Every surface text may sit on in a theme. */
const surfaces = (mode: ThemeMode): string[] => [
  ...Object.values(PRESETS[mode].background),
  ...Object.values(PRESETS[mode].cards),
  ...Object.values(PRESETS[mode].panels),
];

describe.each(MODES)("every mix of %s colors stays readable", (mode) => {
  it("main and quiet text on every background, card and panel", () => {
    const failures = Object.entries(
      PRESETS[mode].text as Record<string, TextPreset>,
    ).flatMap(([name, text]) =>
      surfaces(mode).flatMap((surface) =>
        [text.main, text.quiet]
          .filter((color) => contrast(color, surface) < AA)
          .map((color) => `${name} ${color} on ${surface}`),
      ),
    );

    expect(failures).toEqual([]);
  });

  it("accent links on backgrounds and cards, button text on the accent", () => {
    const onSurface = [
      ...Object.values(PRESETS[mode].background),
      ...Object.values(PRESETS[mode].cards),
    ];
    const buttonText = mode === "light" ? "#ffffff" : "#0b0f0d";
    const failures = Object.entries(ACCENTS).flatMap(([name, shades]) => [
      ...onSurface
        .filter((surface) => contrast(shades[mode], surface) < AA)
        .map((surface) => `${name} on ${surface}`),
      ...(contrast(buttonText, shades[mode]) < AA ? [`text on ${name}`] : []),
    ]);

    expect(failures).toEqual([]);
  });

  it("menu text, hover and the active section", () => {
    const failures = Object.entries(
      PRESETS[mode].menu as Record<string, MenuPreset>,
    )
      .filter(([, menu]) => menu.isDark)
      .flatMap(([name, menu]) => [
        ...(contrast(menu.foreground, menu.background) < AA
          ? [`${name} text`]
          : []),
        ...(contrast("#ffffff", menu.hover) < AA ? [`${name} hover`] : []),
        ...(menu.mark && contrast(menu.mark, menu.background) < AA
          ? [`${name} mark`]
          : []),
      ]);

    expect(failures).toEqual([]);
  });
});

describe("ready themes", () => {
  it("only use colors that exist", () => {
    for (const theme of Object.values(READY_THEMES)) {
      expect(themeOf(theme)).toEqual(theme);
    }
  });
});

describe("themeOf", () => {
  it("gives a business that chose nothing the look the CRM always had", () => {
    expect(themeOf(undefined)).toEqual(DEFAULT_THEME);
  });

  it("keeps the menu a business chose before themes existed", () => {
    expect(themeOf({ menuColor: "navy", menuStyle: "dark" }).light.menu).toBe(
      "navy",
    );
    expect(themeOf({ menuColor: "navy", menuStyle: "light" }).light.menu).toBe(
      "light",
    );
  });

  it("replaces unknown colors with the defaults", () => {
    const theme = themeOf({ light: { accent: "red", cards: "sky" } });

    expect(theme.light.accent).toBe("green");
    expect(theme.light.cards).toBe("sky");
    expect(Object.keys(theme.dark)).toEqual([...THEME_PARTS]);
  });
});

describe("themeVariables", () => {
  it("paints a light menu like the cards with the accent as its mark", () => {
    const colors = { ...DEFAULT_THEME.light, menu: "light", accent: "blue" };

    const variables = themeVariables("light", colors);

    expect(variables["--sidebar"]).toBe(variables["--card"]);
    expect(variables["--sidebar-primary"]).toBe(ACCENTS.blue.light);
  });

  it("writes a block for each theme, the dark one last", () => {
    const css = themeCss(DEFAULT_THEME);

    expect(css.indexOf(":root:root")).toBeLessThan(css.indexOf(":root.dark"));
    expect(css).toContain("--background: #121614;");
  });
});

describe("brandColors", () => {
  it("uses the menu of a dark menu and the accent of a light one", () => {
    expect(brandColors(DEFAULT_THEME)).toEqual({
      background: "#143528",
      mark: "#7fd9ae",
    });
    expect(
      brandColors({
        ...DEFAULT_THEME,
        light: { ...DEFAULT_THEME.light, menu: "light" },
      }).background,
    ).toBe(ACCENTS.green.light);
  });
});
