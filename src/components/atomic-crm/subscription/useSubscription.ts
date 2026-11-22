import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import { hasPlanFeature } from "./subscriptionLogic";
import type { PlanFeature } from "./types";

export const SUBSCRIPTION_QUERY_KEY = ["subscription", "current"];
export const PLANS_QUERY_KEY = ["subscription", "plans"];

// Prices change rarely: no need to ask on every screen
const STALE_MS = 5 * 60 * 1000;

/**
 * The plan of the current business: status, days, features, limits. Asked
 * again on every screen: the saved copy may belong to the business used
 * before a switch, or predate a payment.
 */
export const useSubscription = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: () => dataProvider.getSubscription(),
  });
};

export const usePlans = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: () => dataProvider.getPlans(),
    staleTime: STALE_MS,
  });
};

/**
 * Whether the plan includes a feature. While the plan loads the answer is
 * "yes", so a paid screen does not flash a lock; the server decides anyway.
 */
export const useHasFeature = (feature: PlanFeature): boolean => {
  const { data, isPending } = useSubscription();
  if (isPending || data == null) return true;
  return hasPlanFeature(data, feature);
};

export const useIsPlatformAdmin = (): boolean => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data } = useQuery({
    queryKey: ["subscription", "platform-admin"],
    queryFn: () => dataProvider.isPlatformAdmin(),
    staleTime: STALE_MS,
  });
  return data === true;
};
