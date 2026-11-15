import { useQuery } from "@tanstack/react-query";
import {
  useDataProvider,
  useLocaleState,
  useStore,
  useTranslate,
} from "ra-core";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { EyeOff, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useBusinessTimeZone } from "../booking/useBookingData";
import { formatMoney } from "../money/money";
import type { ModuleKey } from "../modules/modules";
import { useModules } from "../modules/useModules";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  ChartOrTable,
  Heatmap,
  Legend,
  Meter,
  RankedBars,
  RowsTable,
  StackedBars,
  type Series,
} from "./charts";
import { PERIODS, monthLabel, periodRange, type Period } from "./period";
import type { Analytics } from "./types";

/** Blocks of the page, in order, with the module each one needs. */
const WIDGETS: { key: string; module: ModuleKey | null; wide?: boolean }[] = [
  { key: "kpis", module: null, wide: true },
  { key: "sales_by_month", module: null, wide: true },
  { key: "bookings_by_month", module: "booking" },
  { key: "busy_hours", module: "booking" },
  { key: "top_clients", module: null },
  { key: "top_services", module: "booking" },
  { key: "specialists", module: "booking" },
  { key: "dormant_clients", module: "booking" },
  { key: "clients_by_month", module: null },
  { key: "sources", module: null },
  { key: "deals_by_stage", module: "sales" },
  { key: "stock", module: "stock" },
];

/**
 * Analytics of the business: key figures, sales and bookings by month, busy
 * hours, best clients and services, load of the specialists, clients who
 * stopped coming, where clients come from, deals and stock. Any block can be
 * hidden; "Customize" brings it back. Hidden blocks are remembered on this
 * device for this person.
 */
export const AnalyticsPage = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const { isOn } = useModules();
  const [searchParams, setSearchParams] = useSearchParams();
  const period: Period = (PERIODS as readonly string[]).includes(
    searchParams.get("period") ?? "",
  )
    ? (searchParams.get("period") as Period)
    : "month";
  const [hidden, setHidden] = useStore<string[]>("analytics.hidden", []);

  const range = periodRange(period, timeZone);
  const { data, isPending, error } = useQuery({
    queryKey: ["analytics", period, timeZone],
    queryFn: () => dataProvider.getAnalytics(range.from, range.to),
  });

  const available = WIDGETS.filter(
    (widget) => widget.module == null || isOn(widget.module),
  );
  const shown = available.filter((widget) => !hidden.includes(widget.key));
  const hide = (key: string) => setHidden([...hidden, key]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-2 md:px-0 md:pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">
          {translate("crm.nav.analytics")}
        </h1>
        <div
          className="flex max-w-full overflow-x-auto rounded-md border p-0.5"
          role="radiogroup"
          aria-label={translate("crm.analytics.period")}
        >
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={item === period}
              onClick={() =>
                setSearchParams(item === "month" ? {} : { period: item })
              }
              className={
                item === period
                  ? "shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
                  : "shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {translate(`crm.analytics.periods.${item}`)}
            </button>
          ))}
        </div>
        <Customize
          widgets={available.map((widget) => widget.key)}
          hidden={hidden}
          onChange={setHidden}
        />
      </div>

      {error ? (
        <p className="text-destructive">{translate("crm.analytics.failed")}</p>
      ) : null}
      {isPending ? (
        <p className="text-muted-foreground">{translate("ra.page.loading")}</p>
      ) : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((widget) => (
            <Widget
              key={widget.key}
              id={widget.key}
              wide={widget.wide}
              onHide={() => hide(widget.key)}
            >
              <WidgetBody id={widget.key} data={data} />
            </Widget>
          ))}
        </div>
      ) : null}
      {data && shown.length === 0 ? (
        <p className="text-muted-foreground">
          {translate("crm.analytics.all_hidden")}
        </p>
      ) : null}
    </div>
  );
};

AnalyticsPage.path = "/analytics";

const Widget = ({
  id,
  wide,
  onHide,
  children,
}: {
  id: string;
  wide?: boolean;
  onHide: () => void;
  children: ReactNode;
}) => {
  const translate = useTranslate();
  return (
    <Card className={wide ? "lg:col-span-2" : undefined}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              {translate(`crm.analytics.widgets.${id}.title`)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translate(`crm.analytics.widgets.${id}.hint`)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={onHide}
            aria-label={translate("crm.analytics.hide")}
            title={translate("crm.analytics.hide")}
          >
            <EyeOff className="size-4" />
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  );
};

/** Lists the blocks with a checkbox each: unchecked ones are hidden. */
const Customize = ({
  widgets,
  hidden,
  onChange,
}: {
  widgets: string[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <SlidersHorizontal />
        {translate("crm.analytics.customize")}
        {hidden.length > 0 ? ` (${hidden.length})` : ""}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-semibold">
          {translate("crm.analytics.customize_title")}
        </p>
        <ul className="flex flex-col gap-1">
          {widgets.map((key) => {
            const id = `widget-${key}`;
            return (
              <li key={key}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    checked={!hidden.includes(key)}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? hidden.filter((item) => item !== key)
                          : [...hidden, key],
                      )
                    }
                  />
                  {translate(`crm.analytics.widgets.${key}.title`)}
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const useFormats = (currency: string) => {
  const { locale } = useConfigurationContext();
  const [uiLocale = "uk"] = useLocaleState();
  return {
    money: (minor: number) => formatMoney(minor, currency, locale),
    compactMoney: (minor: number) =>
      formatMoney(minor, currency, locale, { compact: true }),
    month: (month: string) => monthLabel(month, uiLocale),
    weekday: (weekday: number) =>
      new Intl.DateTimeFormat(uiLocale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2024, 0, weekday))),
    day: (day: string | null) =>
      day
        ? new Intl.DateTimeFormat(uiLocale, {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(`${day}T12:00:00Z`))
        : "",
  };
};

const Empty = () => {
  const translate = useTranslate();
  return (
    <p className="text-sm text-muted-foreground">
      {translate("crm.analytics.empty")}
    </p>
  );
};

const WidgetBody = ({ id, data }: { id: string; data: Analytics }) => {
  const translate = useTranslate();
  const f = useFormats(data.currency);
  const { dealStages } = useConfigurationContext();
  const k = data.kpis;

  switch (id) {
    case "kpis": {
      const attended = k.completed + k.no_show;
      const tiles = [
        { key: "revenue", value: f.money(k.revenue) },
        { key: "average_ticket", value: f.money(k.average_ticket) },
        { key: "bookings", value: String(k.bookings) },
        {
          key: "attendance",
          value:
            attended > 0
              ? `${Math.round((k.completed / attended) * 100)}%`
              : "—",
        },
        { key: "new_clients", value: String(k.new_clients) },
        {
          key: "reply_minutes",
          value:
            k.reply_minutes == null
              ? "—"
              : translate("crm.chats.waited_minutes", {
                  count: k.reply_minutes,
                }),
        },
      ];
      return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <div key={tile.key} className="flex flex-col-reverse gap-1">
              <dt className="text-sm text-muted-foreground">
                {translate(`crm.analytics.kpis.${tile.key}`)}
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      );
    }

    case "sales_by_month": {
      const series: Series[] = [
        {
          key: "bookings",
          label: translate("crm.analytics.series.bookings_revenue"),
          color: "var(--series-1)",
        },
        {
          key: "deals",
          label: translate("crm.analytics.series.deals"),
          color: "var(--series-2)",
        },
      ];
      const rows = data.sales_by_month.map((row) => ({
        label: f.month(row.month),
        values: { bookings: row.bookings, deals: row.deals },
      }));
      return (
        <>
          <Legend series={series} />
          <ChartOrTable
            chart={
              <StackedBars
                rows={rows}
                series={series}
                format={f.compactMoney}
              />
            }
            table={
              <RowsTable
                rows={rows}
                series={series}
                format={f.money}
                firstColumn={translate("crm.analytics.month")}
              />
            }
          />
        </>
      );
    }

    case "bookings_by_month": {
      const series: Series[] = [
        {
          key: "completed",
          label: translate("crm.booking.statuses.completed"),
          color: "var(--series-1)",
        },
        {
          key: "booked",
          label: translate("crm.analytics.series.booked"),
          color: "var(--series-2)",
        },
        {
          key: "no_show",
          label: translate("crm.booking.statuses.no_show"),
          color: "var(--series-3)",
        },
      ];
      const rows = data.bookings_by_month.map((row) => ({
        label: f.month(row.month),
        values: {
          completed: row.completed,
          booked: row.booked,
          no_show: row.no_show,
        },
      }));
      return (
        <>
          <Legend series={series} />
          <ChartOrTable
            chart={<StackedBars rows={rows} series={series} />}
            table={
              <RowsTable
                rows={rows}
                series={series}
                firstColumn={translate("crm.analytics.month")}
              />
            }
          />
        </>
      );
    }

    case "busy_hours":
      return data.busy_hours.length ? (
        <Heatmap cells={data.busy_hours} weekdayLabel={f.weekday} />
      ) : (
        <Empty />
      );

    case "top_clients":
      return data.top_clients.length ? (
        <RankedBars
          rows={data.top_clients.map((client) => ({
            key: client.id,
            label: (
              <Link
                to={`/companies/${client.id}/show`}
                className="hover:underline"
              >
                {client.name}
              </Link>
            ),
            value: client.revenue,
            note: translate("crm.analytics.visits", {
              smart_count: client.visits,
            }),
          }))}
          format={f.money}
        />
      ) : (
        <Empty />
      );

    case "top_services":
      return data.top_services.length ? (
        <RankedBars
          rows={data.top_services.map((service) => ({
            key: service.id,
            label: service.name,
            value: service.bookings,
            note: f.money(service.revenue),
          }))}
          format={(value) =>
            translate("crm.analytics.bookings_count", { smart_count: value })
          }
        />
      ) : (
        <Empty />
      );

    case "specialists":
      return data.specialists.length ? (
        <div className="flex flex-col gap-3">
          {data.specialists.map((person) => (
            <Meter
              key={person.id}
              label={person.name}
              share={
                person.working_minutes > 0
                  ? person.booked_minutes / person.working_minutes
                  : 0
              }
              note={translate("crm.analytics.hours_of", {
                booked: Math.round(person.booked_minutes / 60),
                total: Math.round(person.working_minutes / 60),
              })}
            />
          ))}
        </div>
      ) : (
        <Empty />
      );

    case "dormant_clients":
      return data.dormant_clients.length ? (
        <ul className="flex flex-col divide-y">
          {data.dormant_clients.map((client) => (
            <li
              key={client.id}
              className="flex items-baseline justify-between gap-3 py-2 text-sm"
            >
              <Link
                to={`/companies/${client.id}/show`}
                className="truncate font-medium hover:underline"
              >
                {client.name}
              </Link>
              <span className="shrink-0 text-muted-foreground">
                {translate("crm.analytics.last_visit", {
                  day: f.day(client.last_day),
                })}{" "}
                ·{" "}
                {translate("crm.analytics.visits", {
                  smart_count: client.visits,
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate("crm.analytics.no_dormant")}
        </p>
      );

    case "clients_by_month": {
      const series: Series[] = [
        {
          key: "new_clients",
          label: translate("crm.analytics.kpis.new_clients"),
          color: "var(--series-1)",
        },
      ];
      const rows = data.clients_by_month.map((row) => ({
        label: f.month(row.month),
        values: { new_clients: row.new_clients },
      }));
      return (
        <ChartOrTable
          chart={<StackedBars rows={rows} series={series} height={120} />}
          table={
            <RowsTable
              rows={rows}
              series={series}
              firstColumn={translate("crm.analytics.month")}
            />
          }
        />
      );
    }

    case "sources": {
      const rows = [
        ...data.booking_sources.map((item) => ({
          key: `booking-${item.source}`,
          label: translate("crm.analytics.booking_source", {
            source: translate(`crm.booking.sources.${item.source}`),
          }),
          value: item.bookings,
        })),
        ...data.channels.map((item) => ({
          key: `chat-${item.kind}`,
          label: translate("crm.analytics.chat_source", {
            channel: translate(`crm.chats.channels.${item.kind}`),
          }),
          value: item.conversations,
        })),
      ];
      return rows.length ? (
        <RankedBars rows={rows} color="var(--series-2)" />
      ) : (
        <Empty />
      );
    }

    case "deals_by_stage":
      return data.deals_by_stage.length ? (
        <RankedBars
          rows={data.deals_by_stage.map((stage) => ({
            key: stage.stage,
            label:
              dealStages.find((item) => item.value === stage.stage)?.label ??
              stage.stage,
            value: stage.amount,
            note: translate("crm.analytics.deals_count", {
              smart_count: stage.deals,
            }),
          }))}
          format={f.money}
          color="var(--series-2)"
        />
      ) : (
        <Empty />
      );

    case "stock":
      return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {[
            { key: "stock_value", value: f.money(data.stock.value) },
            { key: "products", value: String(data.stock.products) },
            { key: "in_stock", value: String(data.stock.in_stock) },
            { key: "out_of_stock", value: String(data.stock.out_of_stock) },
          ].map((tile) => (
            <div key={tile.key} className="flex flex-col-reverse gap-1">
              <dt className="text-sm text-muted-foreground">
                {translate(`crm.analytics.kpis.${tile.key}`)}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      );

    default:
      return null;
  }
};
