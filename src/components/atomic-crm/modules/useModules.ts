import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { ModuleKey } from "./modules";

/**
 * The modules turned on for the current business. While the business loads,
 * isOn answers false, so a turned-off section never flashes into view.
 */
export const useModules = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: business, isPending } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });
  const modules: ModuleKey[] = business?.modules ?? [];
  return {
    modules,
    isPending,
    isOn: (key: ModuleKey) => modules.includes(key),
  };
};
