/**
 * The personal accent color of a user: buttons, selection and the left menu
 * take it instead of the colors the business chose. Each color has a shade
 * for the light theme (white text on it) and one for the dark theme (dark
 * text on it); all pass WCAG AA in both, as text and behind text. Red is not
 * offered: it means errors and deleting.
 */
export const ACCENTS = {
  green: { light: "#1f6f50", dark: "#5fc79a" },
  blue: { light: "#2563eb", dark: "#7aa7ff" },
  teal: { light: "#0f766e", dark: "#4fd1c5" },
  indigo: { light: "#4338ca", dark: "#9aa5ff" },
  violet: { light: "#7c3aed", dark: "#b79cff" },
  plum: { light: "#8a3b6e", dark: "#e590c8" },
  rose: { light: "#be185d", dark: "#f9a8d4" },
  orange: { light: "#c2410c", dark: "#ff9a5c" },
  amber: { light: "#a16207", dark: "#f5c542" },
  graphite: { light: "#3f4a5a", dark: "#c3ccd8" },
} as const;
export type AccentKey = keyof typeof ACCENTS;

/** Where the choice is kept in the app store; empty: as the business has it */
export const ACCENT_STORE_KEY = "accent";

export const isAccentKey = (value: unknown): value is AccentKey =>
  typeof value === "string" && value in ACCENTS;

/**
 * CSS variables of an accent. The page tokens read --brand and --brand-dark
 * (index.css); the menu is tinted from the same color, so the whole
 * interface follows one choice.
 */
export const accentVariables = (accent: AccentKey): Record<string, string> => {
  const color = ACCENTS[accent];
  return {
    "--brand": color.light,
    "--brand-dark": color.dark,
    "--sidebar": `color-mix(in oklab, ${color.light} 42%, #070a09)`,
    "--sidebar-foreground": "#eef3f0",
    "--sidebar-accent": `color-mix(in oklab, ${color.light} 62%, #070a09)`,
    "--sidebar-accent-foreground": "#ffffff",
    "--sidebar-primary": color.dark,
    "--sidebar-primary-foreground": "#0b0f0d",
    "--sidebar-border": "rgb(255 255 255 / 10%)",
    "--sidebar-ring": color.dark,
  };
};
