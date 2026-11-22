import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";

export const PLATFORM_QUERY_KEY = ["platform", "businesses"];

/** Every business of the platform with its plan (platform admins only). */
export const usePlatformBusinesses = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEY,
    queryFn: () => dataProvider.getPlatformBusinesses(),
  });
};
