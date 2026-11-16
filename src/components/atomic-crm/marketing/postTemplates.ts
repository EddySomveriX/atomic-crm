import type { TranslateFunction as Translate } from "ra-core";

import type { Promotion } from "../pricing/types";

/** Ready texts for a post, in the interface language; people edit them. */

interface ServicePrice {
  name: string;
  /** Price in minor units, null when the service has none */
  price: number | null;
}

const conditionOf = (
  promotion: Promotion,
  translate: Translate,
): string | null => {
  switch (promotion.kind) {
    case "happy_hours":
      return promotion.time_from && promotion.time_to
        ? translate("crm.marketing.templates.happy_hours", {
            from: promotion.time_from.slice(0, 5),
            to: promotion.time_to.slice(0, 5),
          })
        : null;
    case "last_minute":
      return translate("crm.marketing.templates.last_minute", {
        hours: promotion.within_hours ?? 24,
      });
    case "first_visit":
      return translate("crm.marketing.templates.first_visit");
    case "promo_code":
      return promotion.code
        ? translate("crm.marketing.templates.promo_code", {
            code: promotion.code,
          })
        : null;
  }
};

/** A post about an offer: its discount, condition, services with the new price and how to book. */
export const offerPostText = ({
  promotion,
  services,
  money,
  formatDate,
  bookingLink,
  translate,
}: {
  promotion: Promotion;
  /** The services of the offer (all of them when it has none) */
  services: ServicePrice[];
  money: (minor: number) => string;
  formatDate: (day: string) => string;
  bookingLink: string | null;
  translate: Translate;
}): string => {
  const lines = [
    translate("crm.marketing.templates.offer_title", {
      name: promotion.name,
      percent: promotion.percent,
    }),
  ];
  const condition = conditionOf(promotion, translate);
  if (condition) lines.push(condition);
  if (promotion.valid_to) {
    lines.push(
      translate("crm.marketing.templates.until", {
        date: formatDate(promotion.valid_to),
      }),
    );
  }
  const priced = services
    .filter((service) => service.price != null)
    .slice(0, 8)
    .map((service) => {
      const price = service.price as number;
      const discounted = Math.round(price * (1 - promotion.percent / 100));
      return `${service.name}: ${money(price)} → ${money(discounted)}`;
    });
  if (priced.length) lines.push("", ...priced);
  if (bookingLink) {
    lines.push(
      "",
      translate("crm.marketing.templates.book", { link: bookingLink }),
    );
  }
  return lines.join("\n");
};

/** A post about the free times of a day, by service. */
export const freeSlotsPostText = ({
  dayLabel,
  slots,
  bookingLink,
  translate,
}: {
  dayLabel: string;
  /** Service name and its free start times "10:00" */
  slots: { service: string; times: string[] }[];
  bookingLink: string | null;
  translate: Translate;
}): string | null => {
  const withTimes = slots.filter((item) => item.times.length > 0);
  if (withTimes.length === 0) return null;
  const lines = [
    translate("crm.marketing.templates.free_title", { day: dayLabel }),
    "",
    ...withTimes.map(
      (item) => `${item.service}: ${item.times.slice(0, 6).join(", ")}`,
    ),
  ];
  if (bookingLink) {
    lines.push(
      "",
      translate("crm.marketing.templates.book", { link: bookingLink }),
    );
  }
  return lines.join("\n");
};
