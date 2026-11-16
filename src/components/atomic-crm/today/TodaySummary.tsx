import { useGetIdentity, useGetList, useGetMany, useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

import { minutesIn } from "../booking/bookingTime";
import type { Booking } from "../booking/types";
import type { Conversation } from "../channels/types";
import { formatMoney } from "../money/money";
import { useModules } from "../modules/useModules";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { greetingKey } from "./businessDay";

/**
 * The top of the start screen: a greeting by first name, the date, and the
 * day in a few figures (bookings, clients waiting, tasks, booked revenue),
 * each shown only when its module is on.
 */
export const TodaySummary = ({
  weekday,
  date,
  timeZone,
  bookings,
  tasksCount,
}: {
  weekday: string;
  date: string;
  timeZone: string;
  bookings: Booking[];
  tasksCount: number;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { isOn } = useModules();
  const { currency, locale } = useConfigurationContext();
  const firstName = String(identity?.fullName ?? "").split(" ")[0];

  const { total: waiting = 0 } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
      filter: { "waiting_since@not.is": null },
    },
    { enabled: isOn("chats"), refetchInterval: 30_000 },
  );
  const productIds = [...new Set(bookings.map((item) => item.product_id))];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );
  const booked = bookings.reduce(
    (sum, item) =>
      sum +
      (products.find((product) => product.id === item.product_id)?.price ?? 0),
    0,
  );

  const figures = [
    isOn("booking")
      ? {
          key: "bookings",
          value: String(bookings.length),
          label: translate("crm.today.figures.bookings", {
            smart_count: bookings.length,
          }),
          tone: "text-primary",
        }
      : null,
    isOn("chats")
      ? {
          key: "waiting",
          value: String(waiting),
          label: translate("crm.today.figures.waiting"),
          tone: waiting > 0 ? "text-destructive" : "text-foreground",
        }
      : null,
    isOn("tasks")
      ? {
          key: "tasks",
          value: String(tasksCount),
          label: translate("crm.today.figures.tasks", {
            smart_count: tasksCount,
          }),
          tone: "text-foreground",
        }
      : null,
    isOn("booking") && booked > 0
      ? {
          key: "booked",
          value: formatMoney(booked, currency, locale),
          label: translate("crm.today.figures.booked"),
          tone: "text-foreground",
        }
      : null,
  ].filter((item) => item != null);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {translate(greetingKey(minutesIn(new Date(), timeZone)))}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-base text-muted-foreground first-letter:uppercase">
          {weekday}, {date}
        </p>
      </div>
      {figures.length > 0 ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {figures.map((item) => (
            <div key={item.key} className="flex items-baseline gap-2">
              <dd
                className={cn("text-2xl font-semibold tabular-nums", item.tone)}
              >
                {item.value}
              </dd>
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
};
