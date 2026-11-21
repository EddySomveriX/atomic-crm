/**
 * Appearance of a business: the color and style of the left menu and the
 * font of the interface, kept in its configuration. Colors are presets
 * checked for contrast (WCAG AA for the menu text), so any choice stays
 * readable. A user may pick a personal accent instead (accent.ts).
 */

export const MENU_COLORS = {
  forest: { background: "#143528", hover: "#1f4a39", mark: "#7fd9ae" },
  graphite: { background: "#1c1f23", hover: "#2c3137", mark: "#e2e8f0" },
  navy: { background: "#12284a", hover: "#1d3b68", mark: "#8ec5ff" },
  teal: { background: "#0f3b40", hover: "#195259", mark: "#7fe0dc" },
  plum: { background: "#3a1838", hover: "#552552", mark: "#f2b0e8" },
  wine: { background: "#4a1620", hover: "#65212e", mark: "#ffb7c3" },
} as const;
export type MenuColor = keyof typeof MENU_COLORS;

export type MenuStyle = "dark" | "light";

export const FONTS = {
  inter: "Inter Variable",
  onest: "Onest Variable",
  manrope: "Manrope Variable",
  golos: "Golos Text Variable",
  montserrat: "Montserrat Variable",
  nunito: "Nunito Variable",
} as const;
export type FontKey = keyof typeof FONTS;

export interface Appearance {
  menuColor: MenuColor;
  menuStyle: MenuStyle;
  font: FontKey;
}

export const DEFAULT_APPEARANCE: Appearance = {
  menuColor: "forest",
  menuStyle: "dark",
  font: "inter",
};

/** A stored appearance with unknown or missing values replaced by defaults. */
export const appearanceOf = (value: Partial<Appearance> | undefined) =>
  ({
    menuColor:
      value?.menuColor && value.menuColor in MENU_COLORS
        ? value.menuColor
        : DEFAULT_APPEARANCE.menuColor,
    menuStyle: value?.menuStyle === "light" ? "light" : "dark",
    font:
      value?.font && value.font in FONTS ? value.font : DEFAULT_APPEARANCE.font,
  }) as Appearance;

/**
 * CSS variables of the menu for an appearance. A light menu keeps the chosen
 * color for the mark of the active section and its icons.
 */
export const menuVariables = (
  appearance: Appearance,
): Record<string, string> => {
  const color = MENU_COLORS[appearance.menuColor];
  if (appearance.menuStyle === "light") {
    return {
      "--sidebar": "var(--card)",
      "--sidebar-foreground": "var(--foreground)",
      "--sidebar-accent": "var(--muted)",
      "--sidebar-accent-foreground": "var(--foreground)",
      "--sidebar-primary": color.background,
      "--sidebar-primary-foreground": "#ffffff",
      "--sidebar-border": "var(--border)",
      "--sidebar-ring": color.background,
    };
  }
  return {
    "--sidebar": color.background,
    "--sidebar-foreground": "#eef3f0",
    "--sidebar-accent": color.hover,
    "--sidebar-accent-foreground": "#ffffff",
    "--sidebar-primary": color.mark,
    "--sidebar-primary-foreground": color.background,
    "--sidebar-border": "rgb(255 255 255 / 10%)",
    "--sidebar-ring": color.mark,
  };
};

/** Loads the files of a font only when a business picks it. */
export const loadFont = (font: FontKey): Promise<unknown> => {
  switch (font) {
    case "manrope":
      return import("@fontsource-variable/manrope");
    case "golos":
      return import("@fontsource-variable/golos-text");
    case "montserrat":
      return import("@fontsource-variable/montserrat");
    case "nunito":
      return import("@fontsource-variable/nunito");
    case "onest":
      return import("@fontsource-variable/onest");
    default:
      return Promise.resolve();
  }
};
