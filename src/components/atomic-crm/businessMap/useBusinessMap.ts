import { useQuery } from "@tanstack/react-query";
import { useCanAccess, useDataProvider, useGetList, useStore } from "ra-core";

import { periodRange } from "../analytics/period";
import { addDays, dayIn, zonedDateTime } from "../booking/bookingTime";
import type { Booking } from "../booking/types";
import { useBusinessTimeZone, useSpecialists } from "../booking/useBookingData";
import type { CrmDataProvider } from "../providers/types";
import type { Company } from "../types";
import { keepBest, pointsOf } from "./boardLogic";

const NEW_CLIENT_DAYS = 7;
const NEW_CLIENTS_SHOWN = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the business board shows: this month's figures, today's
 * bookings, the team, new clients of the week, suppliers and the monthly
 * expenses (for those who may see costs), plus the best points ever shown.
 */
export const useBusinessMap = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const range = periodRange("month", timeZone);
  const today = dayIn(new Date(), timeZone);
  const { canAccess: canSeeCosts } = useCanAccess({
    resource: "costs",
    action: "list",
  });

  const business = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });
  // The same cache entry as the analytics page for this month
  const analytics = useQuery({
    queryKey: ["analytics", "month", timeZone],
    queryFn: () => dataProvider.getAnalytics(range.from, range.to),
  });
  const costs = useQuery({
    queryKey: ["cost_inputs"],
    queryFn: () => dataProvider.getCostInputs(),
    enabled: canSeeCosts === true,
  });
  const { specialists } = useSpecialists();
  const { data: bookings = [] } = useGetList<Booking>("bookings", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "starts_at", order: "ASC" },
    filter: {
      "starts_at@gte": zonedDateTime(today, "00:00", timeZone).toISOString(),
      "starts_at@lt": zonedDateTime(
        addDays(today, 1),
        "00:00",
        timeZone,
      ).toISOString(),
      "status@neq": "cancelled",
    },
  });
  const newClients = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: NEW_CLIENTS_SHOWN },
    sort: { field: "created_at", order: "DESC" },
    filter: {
      "roles@cs": "{client}",
      "created_at@gte": new Date(
        Date.now() - NEW_CLIENT_DAYS * DAY_MS,
      ).toISOString(),
    },
  });
  const suppliers = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: { "roles@cs": "{supplier}" },
  });

  const [bestPoints, setBestPoints] = useStore<Record<string, number>>(
    "business_map.best_points",
    {},
  );
  const businessId = business.data?.id ? String(business.data.id) : null;
  const current = analytics.data ? pointsOf(analytics.data) : 0;
  const points = keepBest(
    businessId ? bestPoints[businessId] : undefined,
    current,
  );
  /** Remembers the points shown, so the level never goes back. */
  const rememberPoints = () => {
    if (businessId && points > (bestPoints[businessId] ?? 0)) {
      setBestPoints({ ...bestPoints, [businessId]: points });
    }
  };

  return {
    businessName: business.data?.name ?? "",
    analytics: analytics.data,
    isPending: analytics.isPending,
    error: analytics.error,
    retry: () => analytics.refetch(),
    overheadMonthly: costs.data?.overhead_monthly ?? null,
    specialists,
    bookings,
    newClients: newClients.data ?? [],
    newClientsTotal: newClients.total ?? 0,
    suppliersTotal: suppliers.total ?? 0,
    points,
    rememberPoints,
  };
};
