import { useStore } from "ra-core";
import { useEffect } from "react";

import { ACCENT_STORE_KEY, accentVariables, isAccentKey } from "./accent";

import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  FONTS,
  appearanceOf,
  loadFont,
  menuVariables,
  type Appearance,
} from "./appearance";

/** The appearance of the current business. */
export const useAppearance = (): Appearance => {
  const { appearance } = useConfigurationContext();
  return appearanceOf(appearance);
};

/**
 * Applies the appearance of the current business to the page: the menu
 * colors as CSS variables (or the user's personal accent) and the font.
 */
export const useApplyAppearance = () => {
  const appearance = useAppearance();
  const { menuColor, menuStyle, font } = appearance;
  const [accent] = useStore<string | null>(ACCENT_STORE_KEY, null);
  useEffect(() => {
    const appearance = { menuColor, menuStyle, font };
    const root = document.documentElement;
    // A personal accent of the user wins over the colors of the business
    const variables = isAccentKey(accent)
      ? accentVariables(accent)
      : menuVariables(appearance);
    Object.entries(variables).forEach(([name, value]) =>
      root.style.setProperty(name, value),
    );
    loadFont(appearance.font).then(() =>
      root.style.setProperty(
        "--app-font",
        `"${FONTS[appearance.font]}", ui-sans-serif, system-ui, sans-serif`,
      ),
    );
    return () => {
      Object.keys(variables).forEach((name) => root.style.removeProperty(name));
      root.style.removeProperty("--app-font");
    };
  }, [menuColor, menuStyle, font, accent]);
};
