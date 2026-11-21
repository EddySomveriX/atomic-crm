import {
  useCanAccess,
  useGetList,
  useGetMany,
  useLocaleState,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useMemo, useState, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Users,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Product } from "../products/types";
import { formatBusinessDate } from "../today/businessDay";
import type { ClientReliability } from "../reliability/types";
import type { Company } from "../types";
import { BookingDialog, type BookingDraft } from "./BookingDialog";
import {
  addDays,
  dayIn,
  isoWeekday,
  minutesIn,
  minutesOf,
  timeOfMinutes,
  zonedDateTime,
} from "./bookingTime";
import {
  columnsOfDay,
  dayRange,
  freeGaps,
  placeSpan,
  type DayRange,
} from "./calendarLayout";
import {
  specialistName,
  type Booking,
  type Specialist,
  type WorkingHours,
} from "./types";
import { useBusinessTimeZone, useSpecialists } from "./useBookingData";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "../misc/PageStates";

/** Height of one hour in the day view */
const HOUR_HEIGHT = 64;
/** A click on the grid snaps to this many minutes */
const SNAP_MINUTES = 15;

type Opened =
  { kind: "new"; draft: BookingDraft } | { kind: "edit"; booking: Booking };

/**
 * The booking calendar (TZ section 5.3): one day, a column per specialist
 * working that day, in the business time zone. A click on free time books
 * it; a click on a booking opens it. The day is in the URL (?day=).
 */
export const CalendarPage = () => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const timeZone = useBusinessTimeZone();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = dayIn(new Date(), timeZone);
  const nowMinutes = minutesIn(new Date(), timeZone);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("day") ?? "")
    ? searchParams.get("day")!
    : today;
  const setDay = (next: string) =>
    setSearchParams(next === today ? {} : { day: next });

  const { specialists } = useSpecialists();
  const { canAccess: canWrite } = useCanAccess({
    resource: "bookings",
    action: "create",
  });
  const [opened, setOpened] = useState<Opened | null>(null);
  const [mobileColumn, setMobileColumn] = useState<Identifier | null>(null);

  const dayStart = zonedDateTime(day, "00:00", timeZone);
  const dayEnd = zonedDateTime(addDays(day, 1), "00:00", timeZone);
  const { data: hours = [] } = useGetList<WorkingHours>("working_hours", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "starts_at", order: "ASC" },
    filter: { weekday: isoWeekday(day) },
  });
  const { data: allBookings = [] } = useGetList<Booking>("bookings", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "starts_at", order: "ASC" },
    filter: {
      "starts_at@gte": dayStart.toISOString(),
      "starts_at@lt": dayEnd.toISOString(),
    },
  });
  const bookings = allBookings.filter((item) => item.status !== "cancelled");

  const productIds = [...new Set(bookings.map((item) => item.product_id))];
  const clientIds = [
    ...new Set(bookings.flatMap((item) => item.client_id ?? [])),
  ];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );
  const productName = (id: Identifier) =>
    products.find((item) => item.id === id)?.name ?? "";
  const { data: reliabilities = [] } = useGetMany<ClientReliability>(
    "client_reliability",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );
  // A client to watch shows its level next to the name
  const clientName = (id: Identifier | null) => {
    const name = clients.find((item) => item.id === id)?.name ?? null;
    const level = reliabilities.find((item) => item.id === id)?.level;
    return name && (level === "watch" || level === "unreliable")
      ? `${name} · ${translate(`crm.reliability.levels.${level}`)}`
      : name;
  };

  const range = useMemo(
    () => dayRange(hours, bookings, timeZone),
    [hours, bookings, timeZone],
  );
  const columns = columnsOfDay(
    specialists.map((item) => item.id),
    hours,
    bookings,
  );
  const shownColumn =
    columns.find((id) => id === mobileColumn) ?? columns[0] ?? null;
  const { weekday, day: dateLabel } = formatBusinessDate(
    dayStart,
    timeZone,
    uiLocale,
  );

  const openNew = (draft: Partial<BookingDraft> = {}) =>
    canWrite ? setOpened({ kind: "new", draft: { day, ...draft } }) : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-28 pt-4 md:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex flex-col leading-tight">
          <span className="text-sm text-muted-foreground first-letter:uppercase">
            {weekday}
          </span>
          <span className="text-2xl font-semibold">{dateLabel}</span>
        </h1>
        <Button
          variant="outline"
          size="icon"
          aria-label={translate("crm.booking.previous_day")}
          onClick={() => setDay(addDays(day, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDay(today)}
          disabled={day === today}
        >
          {translate("crm.booking.today")}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={translate("crm.booking.next_day")}
          onClick={() => setDay(addDays(day, 1))}
        >
          <ChevronRight />
        </Button>
        <Link
          to="/working-hours"
          className={buttonVariants({ variant: "outline" })}
          aria-label={translate("crm.booking.schedule")}
        >
          <Clock />
          <span className="hidden sm:inline">
            {translate("crm.booking.schedule")}
          </span>
        </Link>
        <Link
          to="/team"
          className={buttonVariants({ variant: "outline" })}
          aria-label={translate("crm.nav.team")}
        >
          <Users />
          <span className="hidden sm:inline">{translate("crm.nav.team")}</span>
        </Link>
        {canWrite ? (
          <Button onClick={() => openNew()}>
            <Plus />
            {translate("crm.booking.new")}
          </Button>
        ) : null}
      </div>

      {columns.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={translate("crm.booking.no_hours_title")}
          text={translate("crm.booking.no_hours")}
          action={
            <Link to="/working-hours" className={buttonVariants()}>
              {translate("crm.booking.set_schedule")}
            </Link>
          }
        />
      ) : (
        <>
          {columns.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto md:hidden">
              {columns.map((id) => (
                <Button
                  key={String(id)}
                  size="sm"
                  variant={id === shownColumn ? "default" : "outline"}
                  onClick={() => setMobileColumn(id)}
                >
                  {specialistName(specialists.find((item) => item.id === id))}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex overflow-x-auto rounded-lg border bg-card">
            <TimeAxis range={range} />
            {columns.map((id) => (
              <SpecialistColumn
                key={String(id)}
                specialist={specialists.find((item) => item.id === id)}
                hours={hours.filter((item) => item.sales_id === id)}
                bookings={bookings.filter((item) => item.sales_id === id)}
                range={range}
                timeZone={timeZone}
                hiddenOnMobile={id !== shownColumn}
                nowMinutes={day === today ? nowMinutes : null}
                productName={productName}
                clientName={clientName}
                onFreeClick={(minutes) =>
                  openNew({ sales_id: id, time: timeOfMinutes(minutes) })
                }
                onBookingClick={(booking) =>
                  setOpened({ kind: "edit", booking })
                }
              />
            ))}
          </div>
        </>
      )}

      {opened ? (
        <BookingDialog
          booking={opened.kind === "edit" ? opened.booking : undefined}
          draft={opened.kind === "new" ? opened.draft : undefined}
          timeZone={timeZone}
          readOnly={!canWrite}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </div>
  );
};

const TimeAxis = ({ range }: { range: DayRange }) => {
  const hours: number[] = [];
  for (let minute = range.start; minute < range.end; minute += 60) {
    hours.push(minute);
  }
  return (
    <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card pt-10">
      {hours.map((minute) => (
        <div
          key={minute}
          className="pr-2 text-right text-xs text-muted-foreground"
          style={{ height: HOUR_HEIGHT }}
        >
          {timeOfMinutes(minute)}
        </div>
      ))}
    </div>
  );
};

interface SpecialistColumnProps {
  specialist: Specialist | undefined;
  hours: WorkingHours[];
  bookings: Booking[];
  range: DayRange;
  timeZone: string;
  hiddenOnMobile: boolean;
  /** Minutes since midnight now, when the day shown is today */
  nowMinutes: number | null;
  productName: (id: Identifier) => string;
  clientName: (id: Identifier | null) => string | null;
  onFreeClick: (minutes: number) => void;
  onBookingClick: (booking: Booking) => void;
}

const SpecialistColumn = ({
  specialist,
  hours,
  bookings,
  range,
  timeZone,
  hiddenOnMobile,
  nowMinutes,
  productName,
  clientName,
  onFreeClick,
  onBookingClick,
}: SpecialistColumnProps) => {
  const translate = useTranslate();
  const height = ((range.end - range.start) / 60) * HOUR_HEIGHT;
  // Free stretches of an hour or more, still ahead: dashed, and a click books
  const gaps = freeGaps(
    hours.map((item) => ({
      start: minutesOf(item.starts_at),
      end: minutesOf(item.ends_at),
    })),
    bookings.map((item) => {
      const start = minutesIn(new Date(item.starts_at), timeZone);
      return {
        start,
        end:
          start +
          (Date.parse(item.blocked_until) - Date.parse(item.starts_at)) /
            60_000,
      };
    }),
  ).filter((gap) => nowMinutes == null || gap.end > nowMinutes);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const minutes =
      range.start +
      ((event.clientY - box.top) / box.height) * (range.end - range.start);
    onFreeClick(Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES);
  };

  return (
    <div
      className={cn(
        "min-w-0 flex-1 border-r last:border-r-0 md:block md:min-w-40",
        hiddenOnMobile ? "hidden" : "block",
      )}
    >
      <div className="flex h-10 items-center truncate border-b px-2 text-sm font-medium">
        {specialistName(specialist)}
      </div>
      <div
        className="relative cursor-pointer"
        style={{ height }}
        onClick={handleClick}
        role="presentation"
      >
        {hours.map((item) => {
          const place = placeSpan(
            minutesOf(item.starts_at),
            minutesOf(item.ends_at),
            range,
          );
          return (
            <div
              key={String(item.id)}
              className="absolute inset-x-0 bg-primary/5"
              style={{ top: `${place.top}%`, height: `${place.height}%` }}
            />
          );
        })}
        {gaps.map((gap) => {
          const from =
            nowMinutes == null
              ? gap.start
              : Math.max(
                  gap.start,
                  Math.ceil(nowMinutes / SNAP_MINUTES) * SNAP_MINUTES,
                );
          if (gap.end - from < SNAP_MINUTES * 2) return null;
          const place = placeSpan(from, gap.end, range);
          return (
            <div
              key={gap.start}
              className="pointer-events-none absolute inset-x-1 flex items-start justify-center rounded-md border border-dashed border-primary/40 pt-1 text-xs text-primary"
              style={{ top: `${place.top}%`, height: `${place.height}%` }}
            >
              {translate("crm.booking.free_from", {
                time: timeOfMinutes(from),
              })}
            </div>
          );
        })}
        {nowMinutes != null &&
        nowMinutes >= range.start &&
        nowMinutes <= range.end ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
            style={{
              top: `${placeSpan(nowMinutes, nowMinutes, range).top}%`,
            }}
            aria-hidden
          />
        ) : null}
        {Array.from({ length: (range.end - range.start) / 60 }, (_, index) => (
          <div
            key={index}
            className="pointer-events-none absolute inset-x-0 border-t border-border/60"
            style={{ top: index * HOUR_HEIGHT }}
          />
        ))}
        {bookings.map((booking) => {
          const start = minutesIn(new Date(booking.starts_at), timeZone);
          const end =
            start +
            (Date.parse(booking.ends_at) - Date.parse(booking.starts_at)) /
              60_000;
          const place = placeSpan(start, end, range);
          const client = clientName(booking.client_id);
          return (
            <button
              key={String(booking.id)}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onBookingClick(booking);
              }}
              className={cn(
                "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm",
                booking.status === "booked" &&
                  "border-primary bg-primary text-primary-foreground",
                booking.status === "completed" &&
                  "border-border bg-muted text-muted-foreground",
                booking.status === "no_show" &&
                  "border-destructive/40 bg-destructive/10 text-muted-foreground line-through",
              )}
              style={{ top: `${place.top}%`, height: `${place.height}%` }}
            >
              <span className="flex items-center gap-1 font-semibold">
                {booking.confirmed_at ? (
                  <CheckCheck
                    className="size-3.5 shrink-0"
                    aria-label={translate("crm.reliability.confirmed_short")}
                  />
                ) : null}
                <span className="truncate">
                  {timeOfMinutes(start)} {productName(booking.product_id)}
                </span>
              </span>
              <span className="block truncate">
                {client ?? translate("crm.booking.no_client")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

CalendarPage.path = "/calendar";
