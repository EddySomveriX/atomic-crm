/**
 * The colors an owner picks from, for each main part of the interface and
 * separately for the light and the dark theme. Every set is checked by
 * theme.test.ts: any mix of choices keeps text readable (WCAG AA).
 * Red is never an accent: it means errors and deleting.
 */

/** Buttons, links, selection: a shade for each theme. */
export const ACCENTS = {
  green: { light: "#1f6f50", dark: "#5fc79a" },
  blue: { light: "#2563eb", dark: "#7aa7ff" },
  teal: { light: "#0f766e", dark: "#4fd1c5" },
  indigo: { light: "#4338ca", dark: "#9aa5ff" },
  violet: { light: "#7c3aed", dark: "#b79cff" },
  plum: { light: "#8a3b6e", dark: "#e590c8" },
  rose: { light: "#be185d", dark: "#f9a8d4" },
  orange: { light: "#c2410c", dark: "#ff9a5c" },
  amber: { light: "#92580a", dark: "#f5c542" },
  graphite: { light: "#3f4a5a", dark: "#c3ccd8" },
} as const;
export type AccentKey = keyof typeof ACCENTS;

/**
 * The left menu. `mark` is the active section; null: the accent of the
 * theme. A light menu takes the color of the cards.
 */
export interface MenuPreset {
  background: string;
  hover: string;
  foreground: string;
  mark: string | null;
  isDark: boolean;
}

export const LIGHT_MENUS = {
  forest: {
    background: "#143528",
    hover: "#1f4a39",
    foreground: "#eef3f0",
    mark: "#7fd9ae",
    isDark: true,
  },
  graphite: {
    background: "#1c1f23",
    hover: "#2c3137",
    foreground: "#eef3f0",
    mark: "#e2e8f0",
    isDark: true,
  },
  navy: {
    background: "#12284a",
    hover: "#1d3b68",
    foreground: "#eef3f0",
    mark: "#8ec5ff",
    isDark: true,
  },
  teal: {
    background: "#0f3b40",
    hover: "#195259",
    foreground: "#eef3f0",
    mark: "#7fe0dc",
    isDark: true,
  },
  plum: {
    background: "#3a1838",
    hover: "#552552",
    foreground: "#eef3f0",
    mark: "#f2b0e8",
    isDark: true,
  },
  wine: {
    background: "#4a1620",
    hover: "#65212e",
    foreground: "#eef3f0",
    mark: "#ffb7c3",
    isDark: true,
  },
  light: {
    background: "#ffffff",
    hover: "#eef0f2",
    foreground: "#16191d",
    mark: null,
    isDark: false,
  },
} satisfies Record<string, MenuPreset>;

export const DARK_MENUS = {
  night: {
    background: "#0c110e",
    hover: "#18241e",
    foreground: "#dfe7e2",
    mark: "#5fc79a",
    isDark: true,
  },
  graphite: {
    background: "#111317",
    hover: "#1f2228",
    foreground: "#e2e6ec",
    mark: "#c3ccd8",
    isDark: true,
  },
  navy: {
    background: "#0b1424",
    hover: "#16233a",
    foreground: "#dfe8f5",
    mark: "#8ec5ff",
    isDark: true,
  },
  teal: {
    background: "#0a1c1e",
    hover: "#14302f",
    foreground: "#dcefee",
    mark: "#7fe0dc",
    isDark: true,
  },
  plum: {
    background: "#160d17",
    hover: "#2a1a2b",
    foreground: "#f0e2ef",
    mark: "#f2b0e8",
    isDark: true,
  },
  wine: {
    background: "#1a0b0f",
    hover: "#2f161c",
    foreground: "#f5e1e4",
    mark: "#ffb7c3",
    isDark: true,
  },
} satisfies Record<string, MenuPreset>;

/** The page behind everything. */
export const LIGHT_BACKGROUNDS = {
  cloud: "#f6f7f8",
  white: "#ffffff",
  mint: "#f1f6f3",
  sky: "#f1f5fa",
  sand: "#f6f3ed",
  lavender: "#f4f3f9",
  blush: "#f9f3f4",
} as const;
export const DARK_BACKGROUNDS = {
  forest: "#121614",
  graphite: "#141518",
  navy: "#0f1522",
  plum: "#17121a",
  coffee: "#18140f",
  black: "#0a0a0a",
} as const;

/** Cards, lists, windows. */
export const LIGHT_CARDS = {
  white: "#ffffff",
  snow: "#fbfbfc",
  mint: "#f8fbf9",
  sky: "#f8fafd",
  sand: "#fcfaf6",
  pearl: "#f4f5f7",
} as const;
export const DARK_CARDS = {
  forest: "#191e1b",
  graphite: "#1c1e22",
  navy: "#172033",
  plum: "#211a24",
  coffee: "#221c16",
  charcoal: "#1a1a1a",
} as const;

/** Bars on the phone, chips, secondary buttons, quiet fills. */
export const LIGHT_PANELS = {
  gray: "#eef0f2",
  mint: "#e6f0ea",
  sky: "#e6edf6",
  sand: "#f0ebe1",
  lavender: "#ecebf5",
  blush: "#f5e9eb",
} as const;
export const DARK_PANELS = {
  forest: "#1f2522",
  graphite: "#24272c",
  navy: "#1d2940",
  plum: "#2a2130",
  coffee: "#2b241c",
  charcoal: "#232323",
} as const;

/** Main text and the quieter text of hints and labels. */
export interface TextPreset {
  main: string;
  quiet: string;
}
export const LIGHT_TEXTS = {
  graphite: { main: "#16191d", quiet: "#5b6470" },
  ink: { main: "#0f1b2d", quiet: "#4d5b70" },
  forest: { main: "#13241c", quiet: "#4e5f56" },
  coffee: { main: "#24190f", quiet: "#63564a" },
  black: { main: "#000000", quiet: "#4b4b4b" },
} satisfies Record<string, TextPreset>;
export const DARK_TEXTS = {
  mist: { main: "#eceeed", quiet: "#a3ada8" },
  snow: { main: "#f5f7fa", quiet: "#aab2bd" },
  warm: { main: "#f3eee7", quiet: "#b3aa9e" },
  ice: { main: "#e8f0fa", quiet: "#a3b3c8" },
} satisfies Record<string, TextPreset>;

/** Lines and the frames of fields. */
export interface BorderPreset {
  line: string;
  field: string;
}
export const LIGHT_BORDERS = {
  soft: { line: "#e3e6ea", field: "#d5dae0" },
  medium: { line: "#d3d8de", field: "#bfc6ce" },
  strong: { line: "#bcc3cc", field: "#9aa3ad" },
} satisfies Record<string, BorderPreset>;
export const DARK_BORDERS = {
  soft: { line: "rgb(255 255 255 / 12%)", field: "rgb(255 255 255 / 16%)" },
  medium: { line: "rgb(255 255 255 / 18%)", field: "rgb(255 255 255 / 24%)" },
  strong: { line: "rgb(255 255 255 / 26%)", field: "rgb(255 255 255 / 34%)" },
} satisfies Record<string, BorderPreset>;
