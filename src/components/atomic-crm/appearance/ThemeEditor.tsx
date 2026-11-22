import { Check } from "lucide-react";
import { useTranslate } from "ra-core";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

import {
  PRESETS,
  READY_THEMES,
  THEME_PARTS,
  menuOf,
  type ThemeColors,
  type ThemeMode,
  type ThemePart,
} from "./theme";
import { ThemePreview } from "./ThemePreview";
import type { BorderPreset, MenuPreset, TextPreset } from "./themePresets";
import { ACCENTS, type AccentKey } from "./themePresets";

type Theme = Record<ThemeMode, ThemeColors>;

const sameTheme = (a: Theme, b: Theme) =>
  THEME_PARTS.every(
    (part) => a.light[part] === b.light[part] && a.dark[part] === b.dark[part],
  );

/** What a swatch shows: the color itself, or text / a frame on the page. */
const swatchLook = (
  mode: ThemeMode,
  part: ThemePart,
  key: string,
  colors: ThemeColors,
): { style: CSSProperties; content?: ReactNode } => {
  const presets = PRESETS[mode];
  const page = (presets.background as Record<string, string>)[
    colors.background
  ];
  const card = (presets.cards as Record<string, string>)[colors.cards];
  switch (part) {
    case "accent":
      return { style: { background: ACCENTS[key as AccentKey][mode] } };
    case "menu": {
      const menu = (presets.menu as Record<string, MenuPreset>)[key];
      const mark = menu.mark ?? ACCENTS[colors.accent as AccentKey][mode];
      return {
        style: { background: menu.isDark ? menu.background : card },
        content: (
          <span
            className="size-2.5 rounded-full"
            style={{ background: mark }}
          />
        ),
      };
    }
    case "text": {
      const text = (presets.text as Record<string, TextPreset>)[key];
      return {
        style: { background: page, color: text.main },
        content: <span className="text-sm font-semibold">Aa</span>,
      };
    }
    case "borders": {
      const border = (presets.borders as Record<string, BorderPreset>)[key];
      return {
        style: {
          background: card,
          boxShadow: `inset 0 0 0 3px ${border.field}`,
        },
      };
    }
    default:
      return {
        style: {
          background: (presets[part] as Record<string, string>)[key],
        },
      };
  }
};

const PartRow = ({
  mode,
  part,
  colors,
  onChange,
}: {
  mode: ThemeMode;
  part: ThemePart;
  colors: ThemeColors;
  onChange: (key: string) => void;
}) => {
  const translate = useTranslate();
  const keys = Object.keys(PRESETS[mode][part]);
  const label = translate(`crm.appearance.parts.${part}.label`);
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {translate(`crm.appearance.parts.${part}.hint`)}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-2"
      >
        {keys.map((key) => {
          const selected = colors[part] === key;
          const name = translate(`crm.appearance.swatches.${key}`);
          const { style, content } = swatchLook(mode, part, key, colors);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              onClick={() => onChange(key)}
              style={style}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full border border-black/10 ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/15",
                selected && "ring-2 ring-foreground",
              )}
            >
              {content}
              {selected ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** One tap paints every part of both themes. */
const ReadyThemes = ({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) => {
  const translate = useTranslate();
  const label = translate("crm.appearance.ready");
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-2"
      >
        {Object.entries(READY_THEMES).map(([key, ready]) => {
          const selected = sameTheme(theme, ready);
          const menu = menuOf("light", ready.light);
          const dots = [
            menu.isDark ? menu.background : "#ffffff",
            (PRESETS.light.background as Record<string, string>)[
              ready.light.background
            ],
            ACCENTS[ready.light.accent as AccentKey].light,
          ];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(ready)}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm",
                selected
                  ? "border-primary bg-accent font-medium"
                  : "hover:bg-muted/60",
              )}
            >
              <span className="flex -space-x-1.5">
                {dots.map((color, index) => (
                  <span
                    key={index}
                    className="size-5 rounded-full border border-black/10"
                    style={{ background: color }}
                  />
                ))}
              </span>
              {translate(`crm.appearance.ready_names.${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * The colors of the business: ready themes, then every main part of the
 * interface for the light and the dark theme, with a live copy of a screen.
 * Every color comes from a checked set, so any mix stays readable.
 */
export const ThemeEditor = ({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) => {
  const translate = useTranslate();
  const [mode, setMode] = useState<ThemeMode>("light");
  const colors = theme[mode];
  const setPart = (part: ThemePart, key: string) =>
    onChange({ ...theme, [mode]: { ...colors, [part]: key } });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-medium">
          {translate("crm.appearance.colors_title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {translate("crm.appearance.colors_hint")}
        </p>
      </div>
      <ReadyThemes theme={theme} onChange={onChange} />
      <div
        role="radiogroup"
        aria-label={translate("crm.appearance.mode")}
        className="inline-flex w-fit rounded-lg border bg-muted p-1"
      >
        {(["light", "dark"] as ThemeMode[]).map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={mode === item}
            onClick={() => setMode(item)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm",
              mode === item
                ? "bg-card font-medium shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {translate(`crm.appearance.modes.${item}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
        <div className="md:sticky md:top-4 md:order-2">
          <ThemePreview mode={mode} colors={colors} />
        </div>
        <div className="md:order-1">
          {THEME_PARTS.map((part) => (
            <PartRow
              key={part}
              mode={mode}
              part={part}
              colors={colors}
              onChange={(key) => setPart(part, key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
