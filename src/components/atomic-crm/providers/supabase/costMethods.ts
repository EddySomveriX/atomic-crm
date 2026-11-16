import { HttpError } from "ra-core";

import type { CostInputs, CostSettings } from "../../costing/types";
import { getSupabaseClient } from "./supabase";

const fail = (message: string, error: { message?: string; code?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/** Cost of services and goods: the figures of the cost screen and its settings. */
export const costMethods = {
  async getCostInputs(): Promise<CostInputs> {
    const { data, error } = await getSupabaseClient().rpc("cost_inputs");
    if (error) fail("Failed to load the costs", error);
    return data as CostInputs;
  },

  /** Saves the settings of the current business (one row per business). */
  async saveCostSettings(settings: CostSettings): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("cost_settings")
      .upsert(settings, { onConflict: "business_id" });
    if (error) fail("Failed to save the settings", error);
  },
};
