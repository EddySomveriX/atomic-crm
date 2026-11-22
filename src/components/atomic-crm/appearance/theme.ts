import {
  ACCENTS,
  DARK_BACKGROUNDS,
  DARK_BORDERS,
  DARK_CARDS,
  DARK_MENUS,
  DARK_PANELS,
  DARK_TEXTS,
  LIGHT_BACKGROUNDS,
  LIGHT_BORDERS,
  LIGHT_CARDS,
  LIGHT_MENUS,
  LIGHT_PANELS,
  LIGHT_TEXTS,
  type AccentKey,
  type MenuPreset,
} from "./themePresets";

export type ThemeMode = "light" | "dark";

/** The parts of the interface an owner colors, in the order shown. */
export const THEME_PARTS = [
  "accent",
  "menu",
  "background",
  "cards",
  "panels",
  "text",
  "borders",
] as const;
export type ThemePart = (typeof THEME_PARTS)[number];

/** The choice for one theme: a preset key for every part. */
export type ThemeColors = Record<ThemePart, string>;

/** Every preset of every part, for each theme. */
export const PRESETS = {
  light: {
    accent: ACCENTS,
    menu: LIGHT_MENUS,
    background: LIGHT_BACKGROUNDS,
    cards: LIGHT_CARDS,
    panels: LIGHT_PANELS,
    text: LIGHT_TEXTS,
    borders: LIGHT_BORDERS,
  },
  dark: {
    accent: ACCENTS,
    menu: DARK_MENUS,
    background: DARK_BACKGROUNDS,
    cards: DARK_CARDS,
    panels: DARK_PANELS,
    text: DARK_TEXTS,
    borders: DARK_BORDERS,
  },
} as const;

/** The look the CRM had before colors were chosen. */
export const DEFAULT_THEME: Record<ThemeMode, ThemeColors> = {
  light: {
    accent: "green",
    menu: "forest",
    background: "cloud",
    cards: "white",
    panels: "gray",
    text: "graphite",
    borders: "soft",
  },
  dark: {
    accent: "green",
    menu: "night",
    background: "forest",
    cards: "forest",
    panels: "forest",
    text: "mist",
    borders: "soft",
  },
};

/** Ready themes: every part of both themes in one tap. */
export const READY_THEMES: Record<string, Record<ThemeMode, ThemeColors>> = {
  forest: DEFAULT_THEME,
  sea: {
    light: {
      accent: "blue",
      menu: "navy",
      background: "sky",
      cards: "white",
      panels: "sky",
      text: "ink",
      borders: "soft",
    },
    dark: {
      accent: "blue",
      menu: "navy",
      background: "navy",
      cards: "navy",
      panels: "navy",
      text: "ice",
      borders: "soft",
    },
  },
  graphite: {
    light: {
      accent: "graphite",
      menu: "graphite",
      background: "cloud",
      cards: "white",
      panels: "gray",
      text: "black",
      borders: "medium",
    },
    dark: {
      accent: "graphite",
      menu: "graphite",
      background: "graphite",
      cards: "graphite",
      panels: "graphite",
      text: "snow",
      borders: "medium",
    },
  },
  lagoon: {
    light: {
      accent: "teal",
      menu: "teal",
      background: "mint",
      cards: "white",
      panels: "mint",
      text: "forest",
      borders: "soft",
    },
    dark: {
      accent: "teal",
      menu: "teal",
      background: "forest",
      cards: "forest",
      panels: "forest",
      text: "mist",
      borders: "soft",
    },
  },
  plum: {
    light: {
      accent: "plum",
      menu: "plum",
      background: "lavender",
      cards: "white",
      panels: "lavender",
      text: "graphite",
      borders: "soft",
    },
    dark: {
      accent: "plum",
      menu: "plum",
      background: "plum",
      cards: "plum",
      panels: "plum",
      text: "snow",
      borders: "soft",
    },
  },
  coffee: {
    light: {
      accent: "amber",
      menu: "wine",
      background: "sand",
      cards: "sand",
      panels: "sand",
      text: "coffee",
      borders: "medium",
    },
    dark: {
      accent: "amber",
      menu: "wine",
      background: "coffee",
      cards: "coffee",
      panels: "coffee",
      text: "warm",
      borders: "soft",
    },
  },
  bright: {
    light: {
      accent: "violet",
      menu: "light",
      background: "white",
      cards: "white",
      panels: "lavender",
      text: "ink",
      borders: "medium",
    },
    dark: {
      accent: "violet",
      menu: "graphite",
      background: "black",
      cards: "charcoal",
      panels: "charcoal",
      text: "snow",
      borders: "medium",
    },
  },
};

/** A stored theme with unknown values replaced by the defaults. */
const colorsOf = (
  mode: ThemeMode,
  stored: Partial<ThemeColors> | undefined,
  fallback: ThemeColors,
): ThemeColors =>
  Object.fromEntries(
    THEME_PARTS.map((part) => {
      const value = stored?.[part];
      const presets = PRESETS[mode][part] as Record<string, unknown>;
      return [part, value && value in presets ? value : fallback[part]];
    }),
  ) as ThemeColors;

/** Appearance as stored before themes: a menu color and a dark/light menu. */
export interface LegacyAppearance {
  menuColor?: string;
  menuStyle?: "dark" | "light";
}

export interface StoredTheme {
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
}

/** Both themes of a business, from what it stored (old settings kept). */
export const themeOf = (
  stored: (StoredTheme & LegacyAppearance) | undefined,
): Record<ThemeMode, ThemeColors> => {
  const legacyMenu =
    stored?.menuStyle === "light" ? "light" : stored?.menuColor;
  const lightFallback = {
    ...DEFAULT_THEME.light,
    ...(legacyMenu && legacyMenu in LIGHT_MENUS ? { menu: legacyMenu } : {}),
  };
  return {
    light: colorsOf("light", stored?.light, lightFallback),
    dark: colorsOf("dark", stored?.dark, DEFAULT_THEME.dark),
  };
};

export const menuOf = (mode: ThemeMode, colors: ThemeColors): MenuPreset =>
  (PRESETS[mode].menu as Record<string, MenuPreset>)[colors.menu];

const accentOf = (mode: ThemeMode, colors: ThemeColors): string =>
  ACCENTS[colors.accent as AccentKey][mode];

/** The CSS variables of one theme (index.css reads them). */
export const themeVariables = (
  mode: ThemeMode,
  colors: ThemeColors,
): Record<string, string> => {
  const presets = PRESETS[mode];
  const accent = accentOf(mode, colors);
  const background = (presets.background as Record<string, string>)[
    colors.background
  ];
  const card = (presets.cards as Record<string, string>)[colors.cards];
  const panel = (presets.panels as Record<string, string>)[colors.panels];
  const text = (
    presets.text as Record<string, { main: string; quiet: string }>
  )[colors.text];
  const border = (
    presets.borders as Record<string, { line: string; field: string }>
  )[colors.borders];
  const menu = menuOf(mode, colors);
  const menuBackground = menu.isDark ? menu.background : card;
  const mark = menu.mark ?? accent;
  return {
    "--background": background,
    "--foreground": text.main,
    "--card": card,
    "--card-foreground": text.main,
    "--popover": card,
    "--popover-foreground": text.main,
    "--primary": accent,
    "--primary-foreground": mode === "light" ? "#ffffff" : "#0b0f0d",
    "--ring": accent,
    "--secondary": panel,
    "--secondary-foreground": text.main,
    "--muted": panel,
    "--muted-foreground": text.quiet,
    "--accent": `color-mix(in oklab, ${accent} ${mode === "light" ? 12 : 18}%, ${mode === "light" ? card : background})`,
    "--accent-foreground": text.main,
    "--border": border.line,
    "--input": border.field,
    "--sidebar": menuBackground,
    "--sidebar-foreground": menu.isDark ? menu.foreground : text.main,
    "--sidebar-accent": menu.isDark ? menu.hover : panel,
    "--sidebar-accent-foreground": menu.isDark ? "#ffffff" : text.main,
    "--sidebar-primary": mark,
    "--sidebar-primary-foreground":
      menu.isDark && menu.mark
        ? menu.background
        : mode === "light"
          ? "#ffffff"
          : "#0b0f0d",
    "--sidebar-border": menu.isDark ? "rgb(255 255 255 / 10%)" : border.line,
    "--sidebar-ring": mark,
  };
};

const block = (selector: string, variables: Record<string, string>) =>
  `${selector} {\n${Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")}\n}`;

/**
 * The style sheet of both themes. The selectors outrank the defaults of
 * index.css (`:root`, `.dark`), and the dark block comes last so it wins
 * while the dark theme is on.
 */
export const themeCss = (theme: Record<ThemeMode, ThemeColors>): string =>
  [
    block(":root:root", themeVariables("light", theme.light)),
    block(":root.dark", themeVariables("dark", theme.dark)),
  ].join("\n");

/** Two colors of the business for pictures it hands out (certificates). */
export const brandColors = (
  theme: Record<ThemeMode, ThemeColors>,
): { background: string; mark: string } => {
  const menu = menuOf("light", theme.light);
  if (menu.isDark && menu.mark) {
    return { background: menu.background, mark: menu.mark };
  }
  return { background: accentOf("light", theme.light), mark: "#ffffff" };
};
