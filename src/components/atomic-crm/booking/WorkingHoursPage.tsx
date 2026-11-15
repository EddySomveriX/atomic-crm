import {
  useCreate,
  useDelete,
  useGetList,
  useLocaleState,
  useNotify,
  usePermissions,
  useTranslate,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { timeOfMinutes, minutesOf } from "./bookingTime";
import { specialistName, type Specialist, type WorkingHours } from "./types";
import { useSpecialists } from "./useBookingData";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** A Monday, to name the weekdays in the interface language */
const A_MONDAY = Date.UTC(2024, 0, 1);

const weekdayName = (weekday: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(A_MONDAY + (weekday - 1) * 86_400_000),
  );

/** "09:00:00" → "09:00" */
const shortTime = (time: string) => timeOfMinutes(minutesOf(time));

/**
 * Working hours of the specialists by weekday, in the business time zone:
 * the bot and the website offer only free times within them. Owners and
 * managers change them (the database enforces it).
 */
export const WorkingHoursPage = () => {
  const translate = useTranslate();
  const { specialists, isPending } = useSpecialists();
  const { permissions } = usePermissions();
  const { data: hours = [] } = useGetList<WorkingHours>("working_hours", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "starts_at", order: "ASC" },
  });
  // Owners and managers set the hours; the interface does not tell a manager
  // from a specialist, so the database refuses a specialist with a message
  const canEdit = permissions !== "accountant";

  if (isPending) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-4 md:px-0">
      <div className="flex items-center gap-2">
        <Link
          to="/calendar"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          aria-label={translate("crm.booking.calendar")}
        >
          <ArrowLeft />
        </Link>
        <h1 className="text-2xl font-semibold">
          {translate("crm.booking.schedule")}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {translate("crm.booking.schedule_hint")}
      </p>
      {specialists.map((specialist) => (
        <SpecialistHours
          key={String(specialist.id)}
          specialist={specialist}
          hours={hours.filter((item) => item.sales_id === specialist.id)}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
};

const SpecialistHours = ({
  specialist,
  hours,
  canEdit,
}: {
  specialist: Specialist;
  hours: WorkingHours[];
  canEdit: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [locale = "uk"] = useLocaleState();
  const [create, { isPending }] = useCreate<WorkingHours>();
  const [remove] = useDelete<WorkingHours>();
  const [adding, setAdding] = useState<number | null>(null);

  const add = (weekday: number, startsAt: string, endsAt: string) =>
    create(
      "working_hours",
      {
        data: {
          sales_id: specialist.id,
          weekday,
          starts_at: startsAt,
          ends_at: endsAt,
        },
      },
      {
        onSuccess: () => setAdding(null),
        onError: (error: unknown) =>
          notify(
            error instanceof Error &&
              error.message.includes("working_hours_no_overlap")
              ? "crm.booking.hours_overlap"
              : "crm.booking.hours_failed",
            { type: "error" },
          ),
      },
    );

  const addWorkweek = async () => {
    for (const weekday of [1, 2, 3, 4, 5]) {
      await add(weekday, "09:00", "18:00");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{specialistName(specialist)}</h2>
          {canEdit && hours.length === 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={addWorkweek}
              disabled={isPending}
            >
              {translate("crm.booking.workweek_preset")}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col divide-y">
          {WEEKDAYS.map((weekday) => {
            const intervals = hours.filter((item) => item.weekday === weekday);
            return (
              <div
                key={weekday}
                className="flex min-h-11 flex-wrap items-center gap-2 py-1.5"
              >
                <span className="w-10 text-sm font-medium capitalize">
                  {weekdayName(weekday, locale)}
                </span>
                {intervals.length === 0 && adding !== weekday ? (
                  <span className="text-sm text-muted-foreground">
                    {translate("crm.booking.day_off")}
                  </span>
                ) : null}
                {intervals.map((item) => (
                  <span
                    key={String(item.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                  >
                    {shortTime(item.starts_at)}–{shortTime(item.ends_at)}
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={translate("ra.action.delete")}
                        className="rounded p-0.5 hover:bg-background"
                        onClick={() =>
                          remove("working_hours", {
                            id: item.id,
                            previousData: item,
                          })
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))}
                {canEdit && adding === weekday ? (
                  <IntervalForm
                    onSubmit={(startsAt, endsAt) =>
                      add(weekday, startsAt, endsAt)
                    }
                    onCancel={() => setAdding(null)}
                    disabled={isPending}
                  />
                ) : null}
                {canEdit && adding !== weekday ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto size-8"
                    aria-label={translate("crm.booking.add_hours")}
                    onClick={() => setAdding(weekday)}
                  >
                    <Plus />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const IntervalForm = ({
  onSubmit,
  onCancel,
  disabled,
}: {
  onSubmit: (startsAt: string, endsAt: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const isValid = minutesOf(endsAt) > minutesOf(startsAt);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isValid) onSubmit(startsAt, endsAt);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        type="time"
        value={startsAt}
        onChange={(event) => setStartsAt(event.target.value)}
        aria-label={translate("resources.working_hours.fields.starts_at")}
        className="w-28"
        required
      />
      <span>–</span>
      <Input
        type="time"
        value={endsAt}
        onChange={(event) => setEndsAt(event.target.value)}
        aria-label={translate("resources.working_hours.fields.ends_at")}
        className="w-28"
        required
      />
      <Button type="submit" size="sm" disabled={disabled || !isValid}>
        {translate("ra.action.add")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {translate("ra.action.cancel")}
      </Button>
    </form>
  );
};

WorkingHoursPage.path = "/working-hours";
