import {
  CalendarClock,
  Cake,
  RotateCcw,
  Star,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useTranslate } from "ra-core";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { RebookDays } from "./RebookDays";
import {
  DEFAULT_REACTIVATION_DAYS,
  isReviewLink,
  type Automation,
  type AutomationKind,
} from "./types";

const ICONS: Record<AutomationKind, LucideIcon> = {
  review: Star,
  rebook: RotateCcw,
  no_show: UserX,
  reactivation: CalendarClock,
  birthday: Cake,
};

export type AutomationChange = Partial<
  Pick<Automation, "enabled" | "days" | "link" | "custom_text">
>;

/**
 * One scenario: a switch, when it sends, its setting, and the text, which
 * the business may write its own way.
 */
export const AutomationCard = ({
  kind,
  automation,
  onChange,
  disabled,
}: {
  kind: AutomationKind;
  automation: Automation | undefined;
  onChange: (change: AutomationChange) => void;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const Icon = ICONS[kind];
  const enabled = automation?.enabled ?? false;
  const switchId = `automation-${kind}`;

  return (
    <li className="flex flex-col gap-3 p-4">
      <label
        htmlFor={switchId}
        className="flex cursor-pointer items-start gap-3"
      >
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {translate(`crm.automations.kinds.${kind}.name`)}
          </span>
          <span className="block text-sm text-muted-foreground">
            {translate(`crm.automations.kinds.${kind}.when`)}
          </span>
        </span>
        <Switch
          id={switchId}
          checked={enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked })}
          disabled={disabled}
        />
      </label>
      {enabled ? (
        <div className="flex flex-col gap-3 pl-8">
          <KindSetting
            kind={kind}
            automation={automation}
            onChange={onChange}
            disabled={disabled}
          />
          <MessageText
            kind={kind}
            value={automation?.custom_text ?? null}
            onSave={(custom_text) => onChange({ custom_text })}
            disabled={disabled}
          />
        </div>
      ) : null}
    </li>
  );
};

const KindSetting = ({
  kind,
  automation,
  onChange,
  disabled,
}: {
  kind: AutomationKind;
  automation: Automation | undefined;
  onChange: (change: AutomationChange) => void;
  disabled: boolean;
}): ReactNode => {
  const translate = useTranslate();
  const [link, setLink] = useState(automation?.link ?? "");
  const [days, setDays] = useState(
    String(automation?.days ?? DEFAULT_REACTIVATION_DAYS),
  );

  if (kind === "rebook") return <RebookDays disabled={disabled} />;
  if (kind === "birthday") {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("crm.automations.birthday_hint")}
      </p>
    );
  }
  if (kind === "review") {
    const saveLink = () => {
      const value = link.trim();
      if (value === (automation?.link ?? "")) return;
      if (value !== "" && !isReviewLink(value)) return;
      onChange({ link: value === "" ? null : value });
    };
    return (
      <label className="flex flex-col gap-1.5 text-sm">
        <span>{translate("crm.automations.review_link")}</span>
        <Input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          onBlur={saveLink}
          placeholder="https://g.page/r/…"
          inputMode="url"
          disabled={disabled}
          aria-invalid={link.trim() !== "" && !isReviewLink(link)}
        />
        <span className="text-xs text-muted-foreground">
          {translate("crm.automations.review_link_hint")}
        </span>
      </label>
    );
  }
  if (kind === "reactivation") {
    const saveDays = () => {
      const value = Number(days);
      if (!Number.isInteger(value) || value < 14 || value > 365) {
        setDays(String(automation?.days ?? DEFAULT_REACTIVATION_DAYS));
        return;
      }
      if (value !== (automation?.days ?? DEFAULT_REACTIVATION_DAYS)) {
        onChange({ days: value });
      }
    };
    return (
      <label className="flex items-center gap-2 text-sm">
        <span>{translate("crm.automations.reactivation_after")}</span>
        <Input
          value={days}
          onChange={(event) => setDays(event.target.value)}
          onBlur={saveDays}
          inputMode="numeric"
          className="h-8 w-20 text-right"
          disabled={disabled}
        />
        <span>{translate("crm.automations.days")}</span>
      </label>
    );
  }
  return null;
};

const MessageText = ({
  kind,
  value,
  onSave,
  disabled,
}: {
  kind: AutomationKind;
  value: string | null;
  onSave: (text: string | null) => void;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ?? "");
  const standard = translate(`crm.automations.kinds.${kind}.text`);
  const sample = {
    name: translate("crm.automations.sample.name"),
    service: translate("crm.automations.sample.service"),
    days: "21",
    business: translate("crm.automations.sample.business"),
    link: "",
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="whitespace-pre-line rounded-md bg-muted px-3 py-2 text-muted-foreground">
          {fillSample(value ?? standard, sample)}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="self-start text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
        >
          {translate("crm.automations.edit_text")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={standard}
        maxLength={1000}
        rows={4}
        aria-label={translate("crm.automations.edit_text")}
      />
      <span className="text-xs text-muted-foreground">
        {translate("crm.automations.placeholders")}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(text.trim() === "" ? null : text.trim());
            setOpen(false);
          }}
        >
          {translate("ra.action.save")}
        </Button>
        {value != null ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onSave(null);
              setText("");
              setOpen(false);
            }}
          >
            {translate("crm.automations.standard_text")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setText(value ?? "");
            setOpen(false);
          }}
        >
          {translate("ra.action.cancel")}
        </Button>
      </div>
    </div>
  );
};

/** A text with example values in place of %{name}, %{service}... */
const fillSample = (template: string, values: Record<string, string>) =>
  template.replace(/%\{(\w+)\}/g, (match, name: string) =>
    name in values ? values[name] : match,
  );
