import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useStore, useTranslate } from "ra-core";
import { useRef, type ChangeEvent } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import {
  CONFIGURATION_STORE_KEY,
  useConfigurationContext,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import {
  defaultDarkModeLogo,
  defaultLightModeLogo,
} from "../root/defaultConfiguration";
import {
  FONTS,
  appearanceOf,
  loadFont,
  storedAppearance,
  type FontKey,
  type ResolvedAppearance,
} from "./appearance";
import { logoFromFile } from "./logoFromFile";
import { menuOf } from "./theme";
import { ThemeEditor } from "./ThemeEditor";

/**
 * The look of the business (owner only): the logo shown in the menu and on
 * the documents of the future, the colors of every main part of the light
 * and the dark theme, the font. Every choice applies at once and is saved
 * for the whole team.
 */
export const AppearanceSettings = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [config, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  // With defaults filled in: the logos of a business that never chose one
  const shown = useConfigurationContext();
  const appearance = appearanceOf(shown.appearance);

  const save = useMutation({
    mutationFn: (next: Partial<ConfigurationContextValue>) => {
      // Currency, formats and country come from the business, not from here
      const {
        currency: _currency,
        locale: _locale,
        countryCode: _country,
        ...stored
      } = { ...config, ...next };
      return dataProvider.updateConfiguration(
        stored as ConfigurationContextValue,
      );
    },
    onError: () => notify("crm.appearance.failed", { type: "error" }),
  });

  const change = (next: Partial<ConfigurationContextValue>) => {
    setConfig({ ...config, ...next } as ConfigurationContextValue);
    save.mutate(next);
  };
  const setAppearance = (next: Partial<ResolvedAppearance>) =>
    change({ appearance: storedAppearance({ ...appearance, ...next }) });

  return (
    <section id="appearance" className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold">
          {translate("crm.appearance.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate("crm.appearance.hint")}
        </p>
      </div>

      <LogoField
        logo={shown.lightModeLogo}
        darkLogo={shown.darkModeLogo}
        isMenuDark={menuOf("light", appearance.theme.light).isDark}
        onChange={(light, dark) =>
          change({ lightModeLogo: light, darkModeLogo: dark })
        }
      />

      <ThemeEditor
        theme={appearance.theme}
        onChange={(theme) => setAppearance({ theme })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">
          {translate("crm.appearance.font")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {(Object.keys(FONTS) as FontKey[]).map((key) => (
            <FontChoice
              key={key}
              font={key}
              selected={appearance.font === key}
              onSelect={() => setAppearance({ font: key })}
            />
          ))}
        </div>
      </fieldset>
    </section>
  );
};

/** A font, written in itself. */
const FontChoice = ({
  font,
  selected,
  onSelect,
}: {
  font: FontKey;
  selected: boolean;
  onSelect: () => void;
}) => {
  const translate = useTranslate();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onPointerEnter={() => loadFont(font)}
      onFocus={() => loadFont(font)}
      className={cn(
        "flex flex-col items-start rounded-md border px-4 py-3 text-left",
        selected ? "border-primary bg-accent" : "hover:bg-muted/60",
      )}
      style={{ fontFamily: `"${FONTS[font]}", system-ui, sans-serif` }}
    >
      <span className="text-base font-semibold">
        {FONTS[font].replace(" Variable", "")}
      </span>
      <span className="text-sm text-muted-foreground">
        {translate("crm.appearance.font_sample")}
      </span>
    </button>
  );
};

/** The logo: one picture for both menus, or a second one for a dark menu. */
const LogoField = ({
  logo,
  darkLogo,
  isMenuDark,
  onChange,
}: {
  logo: string | undefined;
  darkLogo: string | undefined;
  isMenuDark: boolean;
  onChange: (light: string, dark: string) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const darkInput = useRef<HTMLInputElement>(null);
  const isCustom = logo != null && logo !== defaultLightModeLogo;
  const menuLogo = isMenuDark ? (darkLogo ?? logo) : logo;

  const read =
    (apply: (dataUrl: string) => void) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        apply(await logoFromFile(file));
      } catch {
        notify("crm.appearance.logo_failed", { type: "error" });
      }
    };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{translate("crm.appearance.logo")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-md border bg-card p-2">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : null}
        </div>
        <div className="flex h-16 w-40 items-center justify-center rounded-md bg-sidebar p-2">
          {menuLogo ? (
            <img
              src={menuLogo}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => input.current?.click()}>
            <ImageUp />
            {translate("crm.appearance.logo_upload")}
          </Button>
          <button
            type="button"
            className="text-left text-sm underline"
            onClick={() => darkInput.current?.click()}
          >
            {translate("crm.appearance.logo_dark")}
          </button>
          {isCustom ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-left text-sm text-muted-foreground underline"
              onClick={() =>
                onChange(defaultLightModeLogo, defaultDarkModeLogo)
              }
            >
              <Trash2 className="size-3.5" />
              {translate("crm.appearance.logo_reset")}
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {translate("crm.appearance.logo_hint")}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={read((dataUrl) => onChange(dataUrl, dataUrl))}
      />
      <input
        ref={darkInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={read((dataUrl) => onChange(logo ?? dataUrl, dataUrl))}
      />
    </div>
  );
};
