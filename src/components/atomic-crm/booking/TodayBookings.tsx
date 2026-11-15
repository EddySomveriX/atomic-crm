import { useGetList, useGetMany, useTranslate, type Identifier } from "ra-core";
import { Link } from "react-router";

import type { Product } from "../products/types";
import type { Company } from "../types";
import { timeIn } from "./bookingTime";
import { specialistName, type Booking } from "./types";
import { useSpecialists } from "./useBookingData";

/**
 * The bookings of today on the start screen (TZ section 4.1), in time order,
 * with a link to the calendar.
 */
export const TodayBookings = ({
  start,
  end,
  timeZone,
}: {
  start: Date;
  end: Date;
  timeZone: string;
}) => {
  const translate = useTranslate();
  const { specialists } = useSpecialists();
  const { data: bookings = [], isPending } = useGetList<Booking>("bookings", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "starts_at", order: "ASC" },
    filter: {
      "starts_at@gte": start.toISOString(),
      "starts_at@lt": end.toISOString(),
      "status@neq": "cancelled",
    },
  });
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
  const nameOf = <T extends { id: Identifier; name: string }>(
    list: T[],
    id: Identifier | null,
  ) => list.find((item) => item.id === id)?.name;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">
          {translate("crm.today.bookings")}
        </h2>
        <Link to="/calendar" className="text-sm font-medium hover:underline">
          {translate("crm.booking.calendar")}
        </Link>
      </div>
      {!isPending && bookings.length === 0 ? (
        <p className="text-muted-foreground">
          {translate("crm.today.bookings_empty")}
        </p>
      ) : null}
      {bookings.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {bookings.map((booking) => (
            <li key={String(booking.id)}>
              <Link
                to="/calendar"
                className="flex items-baseline gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span className="w-12 shrink-0 font-semibold tabular-nums">
                  {timeIn(new Date(booking.starts_at), timeZone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {nameOf(clients, booking.client_id) ??
                      translate("crm.booking.no_client")}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[
                      nameOf(products, booking.product_id),
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
                {booking.status !== "booked" ? (
                  <span className="text-sm text-muted-foreground">
                    {translate(`crm.booking.statuses.${booking.status}`)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
