import { useEffect } from "react";

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
 * colors as CSS variables and the font of the interface.
 */
export const useApplyAppearance = () => {
  const appearance = useAppearance();
  const { menuColor, menuStyle, font } = appearance;
  useEffect(() => {
    const appearance = { menuColor, menuStyle, font };
    const root = document.documentElement;
    const variables = menuVariables(appearance);
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
  }, [menuColor, menuStyle, font]);
};
