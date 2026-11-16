import { botText, type BotLanguage, type BotTextKey } from "./botTexts.ts";

/**
 * The text of an automatic message to a client
 * (supabase/schemas/22_automations.sql): the business's own text or the
 * standard one, with the review link and the line on how to stop them.
 */

export type AutomationKind =
  "rebook" | "no_show" | "review" | "birthday" | "reactivation";

export interface AutomationText {
  kind: AutomationKind;
  customText: string | null;
  link: string | null;
  values: {
    name: string;
    business: string;
    service: string;
    days: number | string;
  };
}

const TEXT_KEYS: Record<AutomationKind, BotTextKey> = {
  rebook: "auto_rebook",
  no_show: "auto_no_show",
  review: "auto_review",
  birthday: "auto_birthday",
  reactivation: "auto_reactivation",
};

/** Scenarios that end with a "Book" button. */
export const WITH_BOOK_BUTTON: AutomationKind[] = [
  "rebook",
  "no_show",
  "reactivation",
];

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/%\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );

/**
 * The message: the business's own text or the standard one, the review link,
 * and the line on how to stop these messages.
 */
export const automationMessage = (
  language: BotLanguage,
  text: AutomationText,
): string => {
  const values = {
    ...text.values,
    link: text.link ? `\n${text.link}` : "",
  };
  const body = text.customText
    ? fill(text.customText, values) +
      (text.link && !text.customText.includes("%{link}")
        ? `\n${text.link}`
        : "")
    : botText(language, TEXT_KEYS[text.kind], values);
  return `${body.trim()}\n\n${botText(language, "auto_stop_hint")}`;
};
