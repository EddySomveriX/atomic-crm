import { useEffect } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  FONTS,
  appearanceOf,
  loadFont,
  type ResolvedAppearance,
} from "./appearance";
import { themeCss } from "./theme";

/** The appearance of the current business. */
export const useAppearance = (): ResolvedAppearance => {
  const { appearance } = useConfigurationContext();
  return appearanceOf(appearance);
};

/**
 * Applies the appearance of the current business to the page: the colors of
 * both themes as a style sheet (the light/dark switch picks one) and the
 * font.
 */
export const useApplyAppearance = () => {
  const { font, theme } = useAppearance();
  const css = themeCss(theme);
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.businessTheme = "";
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [css]);
  useEffect(() => {
    const root = document.documentElement;
    loadFont(font).then(() =>
      root.style.setProperty(
        "--app-font",
        `"${FONTS[font]}", ui-sans-serif, system-ui, sans-serif`,
      ),
    );
    return () => {
      root.style.removeProperty("--app-font");
    };
  }, [font]);
};
