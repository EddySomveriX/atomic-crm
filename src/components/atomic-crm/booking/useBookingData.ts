import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetList } from "ra-core";

import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import type { Booking, Specialist, WorkingHours } from "./types";

/** The time zone of the current business: booking times follow it. */
export const useBusinessTimeZone = (): string => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: business } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });
  return business?.timezone ?? "Europe/Kyiv";
};

/** Active members of the business, in name order. */
export const useSpecialists = () => {
  const { data = [], isPending } = useGetList<Specialist>("specialists", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "first_name", order: "ASC" },
  });
  return { specialists: data, isPending };
};

/** Services that can be booked: the ones with a duration. */
export const useBookableServices = () => {
  const { data = [], isPending } = useGetList<Product>("products", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
    filter: {
      kind: "service",
      archived: false,
      "duration_minutes@not.is": null,
    },
  });
  return { services: data, isPending };
};

/** Today's working hours and bookings, for the ribbon. */
export const useTodaySchedule = (start: Date, end: Date, weekday: number) => {
  const { data: bookings = [] } = useGetList<Booking>("bookings", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "starts_at", order: "ASC" },
    filter: {
      "starts_at@gte": start.toISOString(),
      "starts_at@lt": end.toISOString(),
      "status@neq": "cancelled",
    },
  });
  const { data: hours = [] } = useGetList<WorkingHours>("working_hours", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "starts_at", order: "ASC" },
    filter: { weekday },
  });
  return { bookings, hours };
};
