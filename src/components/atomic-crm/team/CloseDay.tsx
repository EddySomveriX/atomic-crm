import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  useDataProvider,
  useGetList,
  useGetMany,
  useLocaleState,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { addDays, dayIn, timeIn, zonedDateTime } from "../booking/bookingTime";
import { useBusinessTimeZone, useSpecialists } from "../booking/useBookingData";
import { specialistName, type Booking } from "../booking/types";
import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import type { DayClosing } from "./types";

/**
 * "Close the day" on Today: whether the day is closed, and a button that
 * walks through the visits still unmarked and then keeps the day's totals.
 */
export const CloseDayCard = () => {
  const translate = useTranslate();
  const timeZone = useBusinessTimeZone();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  const today = dayIn(new Date(), timeZone);
  const { data: closings = [] } = useGetList<DayClosing>("day_closings", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "day", order: "DESC" },
    filter: { day: today },
  });
  const closing = closings[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      {closing ? (
        <span className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          {translate("crm.team.day_closed", {
            time: timeIn(new Date(closing.closed_at), timeZone),
            visits: closing.totals.visits,
            revenue: formatMoney(closing.totals.revenue, currency, locale),
          })}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          {translate("crm.team.close_hint")}
        </span>
      )}
      <Button
        variant={closing ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {translate(closing ? "crm.team.close_again" : "crm.team.close_day")}
      </Button>
      {open ? (
        <CloseDayDialog day={today} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
};

const CloseDayDialog = ({
  day,
  onClose,
}: {
  day: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const [update] = useUpdate();
  const [closing, setClosing] = useState(false);
  const { specialists } = useSpecialists();

  const start = zonedDateTime(day, "00:00", timeZone);
  const end = zonedDateTime(addDays(day, 1), "00:00", timeZone);
  const { data: unmarked = [], refetch } = useGetList<Booking>("bookings", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "starts_at", order: "ASC" },
    filter: {
      "starts_at@gte": start.toISOString(),
      "starts_at@lt": end.toISOString(),
      status: "booked",
    },
  });
  const productIds = [...new Set(unmarked.map((item) => item.product_id))];
  const clientIds = [
    ...new Set(unmarked.flatMap((item) => item.client_id ?? [])),
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
  const { data: report = [], refetch: refetchReport } = useQuery({
    queryKey: ["team_report", day, day],
    queryFn: () => dataProvider.getTeamReport(day, day),
  });
  const worked = report.filter(
    (row) => Number(row.visits) + Number(row.no_shows) > 0,
  );
  const revenue = report.reduce((sum, row) => sum + Number(row.revenue), 0);
  const visits = report.reduce((sum, row) => sum + Number(row.visits), 0);

  const mark = (booking: Booking, status: "completed" | "no_show") =>
    update(
      "bookings",
      { id: booking.id, data: { status }, previousData: booking },
      {
        onSuccess: () => {
          refetch();
          refetchReport();
        },
        onError: () => notify("crm.team.failed", { type: "error" }),
      },
    );

  const close = async () => {
    setClosing(true);
    try {
      await dataProvider.closeDay(day);
      await queryClient.invalidateQueries({ queryKey: ["day_closings"] });
      notify("crm.team.day_closed_now", { type: "success" });
      onClose();
    } catch {
      notify("crm.team.close_failed", { type: "error" });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{translate("crm.team.close_day")}</DialogTitle>
        </DialogHeader>
        {unmarked.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {translate("crm.team.mark_hint", {
                smart_count: unmarked.length,
              })}
            </p>
            <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border">
              {unmarked.map((booking) => (
                <li
                  key={booking.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="w-12 shrink-0 font-medium tabular-nums">
                    {timeIn(new Date(booking.starts_at), timeZone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {clients.find((item) => item.id === booking.client_id)
                        ?.name ?? translate("crm.booking.no_client")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        products.find((item) => item.id === booking.product_id)
                          ?.name,
                        specialistName(
                          specialists.find(
                            (item) => item.id === booking.sales_id,
                          ),
                        ),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => mark(booking, "completed")}
                    >
                      {translate("crm.team.came")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mark(booking, "no_show")}
                    >
                      {translate("crm.team.not_came")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-base">
              {translate("crm.team.day_totals", {
                smart_count: visits,
                revenue: money(revenue),
              })}
            </p>
            {worked.length > 0 ? (
              <ul className="flex flex-col divide-y rounded-md border">
                {worked.map((row) => (
                  <li
                    key={row.sales_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {`${row.first_name} ${row.last_name}`.trim()}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {money(Number(row.revenue))}
                    </span>
                    <span className="w-24 text-right font-medium tabular-nums">
                      {Number(row.commission) > 0
                        ? money(Number(row.commission))
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {translate("crm.team.commission_column")}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={close} disabled={closing || unmarked.length > 0}>
            {translate("crm.team.close_day")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
