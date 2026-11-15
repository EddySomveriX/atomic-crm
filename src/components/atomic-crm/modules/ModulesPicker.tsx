import { useTranslate } from "ra-core";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  COMING_MODULES,
  MODULE_KEYS,
  NAV_SECTIONS,
  visibleSections,
  type ModuleKey,
} from "./modules";

/**
 * Turns the modules of a business on and off. Each row says what the module
 * gives; next to the list, a small copy of the menu shows at once what the
 * owner will see. Nothing is deleted by turning a module off.
 */
export const ModulesPicker = ({
  value,
  onChange,
  disabled = false,
}: {
  value: ModuleKey[];
  onChange: (modules: ModuleKey[]) => void;
  disabled?: boolean;
}) => {
  const translate = useTranslate();

  const toggle = (key: ModuleKey, on: boolean) =>
    onChange(
      MODULE_KEYS.filter((item) => (item === key ? on : value.includes(item))),
    );

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="flex flex-col">
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {MODULE_KEYS.map((key) => {
            const section = NAV_SECTIONS.find((item) => item.module === key)!;
            const Icon = section.icon;
            const id = `module-${key}`;
            return (
              <li key={key}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3",
                    disabled && "cursor-default opacity-60",
                  )}
                >
                  <Icon className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {translate(`crm.modules.items.${key}.name`)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {translate(`crm.modules.items.${key}.hint`)}
                    </span>
                  </span>
                  <Switch
                    id={id}
                    checked={value.includes(key)}
                    onCheckedChange={(checked) => toggle(key, checked)}
                    disabled={disabled}
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          {translate("crm.modules.coming", {
            list: COMING_MODULES.map((key) =>
              translate(`crm.modules.coming_items.${key}`),
            ).join(", "),
          })}
        </p>
      </div>
      <MenuPreview modules={value} />
    </div>
  );
};

/** A small copy of the left menu for the chosen modules. */
const MenuPreview = ({ modules }: { modules: ModuleKey[] }) => {
  const translate = useTranslate();
  return (
    <figure className="flex flex-col gap-2" aria-live="polite">
      <figcaption className="text-sm font-medium text-muted-foreground">
        {translate("crm.modules.preview")}
      </figcaption>
      <ul className="flex flex-col gap-0.5 rounded-lg bg-sidebar p-2 text-sidebar-foreground">
        {visibleSections(modules).map((section) => (
          <li
            key={section.key}
            className="flex h-8 items-center gap-2 rounded px-2 text-sm motion-safe:animate-in motion-safe:fade-in"
          >
            <section.icon className="size-4 shrink-0" />
            <span className="truncate">{translate(section.labelKey)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};
