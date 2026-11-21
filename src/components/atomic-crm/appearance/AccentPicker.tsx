import { Check } from "lucide-react";
import { useStore, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  ACCENTS,
  ACCENT_STORE_KEY,
  isAccentKey,
  type AccentKey,
} from "./accent";

/**
 * The user's own color of the interface, in their profile: ten colors, or
 * the colors the business chose. Kept on this device.
 */
export const AccentPicker = () => {
  const translate = useTranslate();
  const [accent, setAccent] = useStore<string | null>(ACCENT_STORE_KEY, null);
  const current = isAccentKey(accent) ? accent : null;

  const swatch = (key: AccentKey | null) => {
    const isOn = current === key;
    const label = translate(`crm.appearance.accents.${key ?? "business"}`);
    return (
      <button
        key={key ?? "business"}
        type="button"
        role="radio"
        aria-checked={isOn}
        aria-label={label}
        title={label}
        onClick={() => setAccent(key)}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-colors",
          isOn ? "border-primary bg-accent font-medium" : "hover:bg-muted/60",
        )}
      >
        <span
          className="flex size-9 items-center justify-center rounded-full border"
          style={
            key
              ? {
                  background: `linear-gradient(135deg, ${ACCENTS[key].light} 50%, ${ACCENTS[key].dark} 50%)`,
                }
              : undefined
          }
        >
          {isOn ? (
            <Check
              className={cn("size-4", key ? "text-white" : "text-foreground")}
            />
          ) : null}
        </span>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {translate("crm.appearance.accent_title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.appearance.accent_hint")}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label={translate("crm.appearance.accent_title")}
          className="grid grid-cols-4 gap-2 sm:grid-cols-6"
        >
          {swatch(null)}
          {(Object.keys(ACCENTS) as AccentKey[]).map((key) => swatch(key))}
        </div>
      </CardContent>
    </Card>
  );
};
