import { useTranslate } from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";

import type { Analytics } from "../analytics/types";
import type { Booking, Specialist } from "../booking/types";
import { specialistName } from "../booking/types";
import type { Company } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { isBusyNow, type ZoneKey } from "./boardLogic";

/** Where the one thing to do in each zone leads. */
const ACTIONS: Record<ZoneKey, string> = {
  entrance: "/chats",
  hall: "/calendar",
  cash: "/analytics",
  stock: "/products",
  return: "/automations",
};

const Row = ({ children }: { children: ReactNode }) => (
  <li className="flex items-center justify-between gap-3 py-2 text-sm">
    {children}
  </li>
);

/**
 * What stands on the chosen zone, by name, and the one thing to do there.
 */
export const ZoneDetails = ({
  zone,
  analytics,
  specialists,
  bookings,
  newClients,
  money,
}: {
  zone: ZoneKey;
  analytics: Analytics;
  specialists: Specialist[];
  bookings: Booking[];
  newClients: Company[];
  money: (minor: number) => string;
}) => {
  const translate = useTranslate();
  const now = new Date();
  const { locale } = useConfigurationContext();
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(`crm.business_map.${key}`, options);

  const lists: Record<ZoneKey, ReactNode> = {
    entrance: newClients.map((client) => (
      <Row key={String(client.id)}>
        <Link to={`/companies/${client.id}/show`} className="hover:underline">
          {client.name}
        </Link>
        <span className="text-muted-foreground">{t("new_client")}</span>
      </Row>
    )),
    hall: specialists.map((member) => {
      const own = bookings.filter(
        (booking) => String(booking.sales_id) === String(member.id),
      );
      return (
        <Row key={String(member.id)}>
          <span>{specialistName(member)}</span>
          <span className="text-muted-foreground tabular-nums">
            {isBusyNow(bookings, member.id, now)
              ? t("busy_now")
              : t("bookings_today", { smart_count: own.length })}
          </span>
        </Row>
      );
    }),
    cash: (
      <>
        <Row>
          <span>{t("income")}</span>
          <span className="tabular-nums">{money(analytics.kpis.revenue)}</span>
        </Row>
        <Row>
          <span>{t("materials")}</span>
          <span className="tabular-nums">
            {money(analytics.kpis.materials_cost)}
          </span>
        </Row>
      </>
    ),
    stock: (
      <>
        <Row>
          <span>{t("products")}</span>
          <span className="tabular-nums">{analytics.stock.products}</span>
        </Row>
        <Row>
          <span>{t("out_of_stock")}</span>
          <span className="tabular-nums">{analytics.stock.out_of_stock}</span>
        </Row>
        <Row>
          <span>{t("stock_value")}</span>
          <span className="tabular-nums">{money(analytics.stock.value)}</span>
        </Row>
      </>
    ),
    return: analytics.dormant_clients.map((client) => (
      <Row key={client.id}>
        <Link to={`/companies/${client.id}/show`} className="hover:underline">
          {client.name}
        </Link>
        <span className="text-muted-foreground">
          {t("last_visit", { day: dayLabel(client.last_day) })}
        </span>
      </Row>
    )),
  };
  const list = lists[zone];
  const isEmpty = Array.isArray(list) && list.length === 0;

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      aria-live="polite"
    >
      <div>
        <h2 className="text-lg font-semibold">{t(`zones.${zone}.title`)}</h2>
        <p className="text-sm text-muted-foreground">
          {t(`zones.${zone}.hint`)}
        </p>
      </div>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          {t(`zones.${zone}.empty`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">{list}</ul>
      )}
      <Link
        to={ACTIONS[zone]}
        className={buttonVariants({ className: "self-start" })}
      >
        {t(`zones.${zone}.action`)}
      </Link>
    </section>
  );
};
