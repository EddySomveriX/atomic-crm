import { formatPrice, type BotLanguage } from "../bot/botTexts.ts";
import { addDays } from "../bot/flowShared.ts";
import type { ReportPeriod } from "./schedule.ts";

/**
 * The text of the weekly report: money and visits against the week before,
 * clients, the busiest specialists and services, and up to three things to
 * do. Built from what public.business_analytics_for() returns.
 */

/** The part of public.business_analytics_for() the report reads. */
export interface ReportAnalytics {
  currency: string;
  kpis: {
    revenue: number;
    completed: number;
    no_show: number;
    new_clients: number;
    waiting_now: number;
  };
  top_services: { name: string; bookings: number }[];
  specialists: {
    name: string;
    booked_minutes: number;
    working_minutes: number;
  }[];
  dormant_clients: unknown[];
  stock: { out_of_stock: number };
}

const TEXTS = {
  uk: {
    title: "Звіт за тиждень: %{period}",
    business: "«%{name}»",
    revenue: "Виручка: %{value}",
    visits: "Візити: %{value}",
    no_show: "Не прийшли: %{value}",
    new_clients: "Нові клієнти: %{value}",
    specialists: "Майстри (зайнятість):",
    specialist_line: "%{name}: %{hours} год, %{load}%",
    services: "Популярні послуги:",
    service_line: "%{name}: %{count}",
    todo: "Що зробити:",
    free_hours:
      "Наступного тижня вільно близько %{hours} год: запропонуйте запис постійним клієнтам.",
    waiting: "У чатах чекають відповіді: %{count}.",
    out_of_stock: "Закінчилися товари: %{count}. Час замовити.",
    dormant:
      "Давно не приходили клієнти: %{count}. Увімкніть повернення клієнтів в «Автоматизаціях».",
    quiet: "Тиждень без записів. Перевірте графік роботи та прайс.",
  },
  en: {
    title: "Weekly report: %{period}",
    business: "“%{name}”",
    revenue: "Revenue: %{value}",
    visits: "Visits: %{value}",
    no_show: "No-shows: %{value}",
    new_clients: "New clients: %{value}",
    specialists: "Specialists (load):",
    specialist_line: "%{name}: %{hours} h, %{load}%",
    services: "Popular services:",
    service_line: "%{name}: %{count}",
    todo: "What to do:",
    free_hours:
      "About %{hours} h are free next week: offer a visit to your regular clients.",
    waiting: "Chats waiting for a reply: %{count}.",
    out_of_stock: "Out of stock items: %{count}. Time to reorder.",
    dormant:
      "Clients who stopped coming: %{count}. Turn on client return in “Automations”.",
    quiet: "No bookings this week. Check the working hours and the price list.",
  },
} as const;

type TextKey = keyof (typeof TEXTS)["uk"];

const LOCALES: Record<BotLanguage, string> = { uk: "uk-UA", en: "en-GB" };
const TOP_COUNT = 3;
const MAX_HINTS = 3;
/** Free time below this is not worth a hint. */
const MIN_FREE_HOURS = 2;
/** The analytics list stops at this many dormant clients. */
const DORMANT_LIST_LIMIT = 10;

const text = (
  language: BotLanguage,
  key: TextKey,
  values: Record<string, string | number> = {},
) =>
  Object.entries(values).reduce<string>(
    (result, [name, value]) => result.replaceAll(`%{${name}}`, String(value)),
    TEXTS[language][key],
  );

/** "+15%" or "−8%" against the week before; empty without a week before. */
export const change = (current: number, previous: number): string => {
  if (previous <= 0) return "";
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return " (=)";
  return percent > 0 ? ` (+${percent}%)` : ` (−${Math.abs(percent)}%)`;
};

const periodLabel = (period: ReportPeriod, language: BotLanguage) =>
  new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatRange(
    new Date(`${period.firstDay}T12:00:00Z`),
    new Date(`${addDays(period.endDay, -1)}T12:00:00Z`),
  );

const hours = (minutes: number) => Math.round(minutes / 60);

/** Up to three things to do this week, the most urgent first. */
export const hintsFor = (
  current: ReportAnalytics,
  upcoming: ReportAnalytics | null,
  language: BotLanguage,
): string[] => {
  const hints: string[] = [];
  if (current.kpis.waiting_now > 0) {
    hints.push(text(language, "waiting", { count: current.kpis.waiting_now }));
  }
  const free = (upcoming?.specialists ?? []).reduce(
    (total, row) =>
      total + Math.max(0, row.working_minutes - row.booked_minutes),
    0,
  );
  if (hours(free) >= MIN_FREE_HOURS) {
    hints.push(text(language, "free_hours", { hours: hours(free) }));
  }
  if (current.stock.out_of_stock > 0) {
    hints.push(
      text(language, "out_of_stock", { count: current.stock.out_of_stock }),
    );
  }
  const dormant = current.dormant_clients.length;
  if (dormant > 0) {
    hints.push(
      text(language, "dormant", {
        count: dormant >= DORMANT_LIST_LIMIT ? `${dormant}+` : dormant,
      }),
    );
  }
  return hints.slice(0, MAX_HINTS);
};

export const buildReport = ({
  businessName,
  language,
  period,
  current,
  previous,
  upcoming,
}: {
  businessName: string;
  language: BotLanguage;
  period: ReportPeriod;
  current: ReportAnalytics;
  previous: ReportAnalytics | null;
  upcoming: ReportAnalytics | null;
}): string => {
  const { kpis } = current;
  const lines = [
    text(language, "title", { period: periodLabel(period, language) }),
    text(language, "business", { name: businessName }),
    "",
    text(language, "revenue", {
      value:
        formatPrice(kpis.revenue, current.currency, language) +
        change(kpis.revenue, previous?.kpis.revenue ?? 0),
    }),
    text(language, "visits", {
      value:
        kpis.completed + change(kpis.completed, previous?.kpis.completed ?? 0),
    }),
    text(language, "no_show", { value: kpis.no_show }),
    text(language, "new_clients", { value: kpis.new_clients }),
  ];

  const busy = current.specialists
    .filter((row) => row.booked_minutes > 0)
    .slice(0, TOP_COUNT);
  if (busy.length > 0) {
    lines.push("", text(language, "specialists"));
    for (const row of busy) {
      lines.push(
        text(language, "specialist_line", {
          name: row.name,
          hours: hours(row.booked_minutes),
          load:
            row.working_minutes > 0
              ? Math.round((row.booked_minutes / row.working_minutes) * 100)
              : 0,
        }),
      );
    }
  }

  const services = current.top_services
    .filter((row) => row.bookings > 0)
    .slice(0, TOP_COUNT);
  if (services.length > 0) {
    lines.push("", text(language, "services"));
    for (const row of services) {
      lines.push(
        text(language, "service_line", { name: row.name, count: row.bookings }),
      );
    }
  }

  const hints = hintsFor(current, upcoming, language);
  if (kpis.completed === 0 && services.length === 0) {
    hints.unshift(text(language, "quiet"));
  }
  if (hints.length > 0) {
    lines.push("", text(language, "todo"));
    for (const hint of hints.slice(0, MAX_HINTS)) lines.push(`• ${hint}`);
  }
  return lines.join("\n");
};
