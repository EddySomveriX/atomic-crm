import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetList } from "ra-core";

import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import type { Specialist } from "./types";

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
