/**
 * Appearance of a business, kept in its configuration: the colors of the
 * light and the dark theme (theme.ts, chosen from checked presets in
 * themePresets.ts) and the font of the interface. Only the owner changes
 * it, for the whole team.
 */
import {
  themeOf,
  type LegacyAppearance,
  type StoredTheme,
  type ThemeColors,
  type ThemeMode,
} from "./theme";

export const FONTS = {
  inter: "Inter Variable",
  onest: "Onest Variable",
  manrope: "Manrope Variable",
  golos: "Golos Text Variable",
  montserrat: "Montserrat Variable",
  nunito: "Nunito Variable",
} as const;
export type FontKey = keyof typeof FONTS;

/** What the configuration stores. */
export interface Appearance extends StoredTheme, LegacyAppearance {
  font?: FontKey;
}

/** The appearance with every value filled in. */
export interface ResolvedAppearance {
  font: FontKey;
  theme: Record<ThemeMode, ThemeColors>;
}

export const DEFAULT_FONT: FontKey = "inter";

/** A stored appearance with unknown or missing values replaced by defaults. */
export const appearanceOf = (
  value: Partial<Appearance> | undefined,
): ResolvedAppearance => ({
  font: value?.font && value.font in FONTS ? value.font : DEFAULT_FONT,
  theme: themeOf(value),
});

/** What to store: the resolved values, without the settings of old versions. */
export const storedAppearance = (
  appearance: ResolvedAppearance,
): Appearance => ({
  font: appearance.font,
  light: appearance.theme.light,
  dark: appearance.theme.dark,
});

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
