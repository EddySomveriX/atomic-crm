import { HttpError, type Identifier } from "ra-core";

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
  async saveCostSettings(settings: Partial<CostSettings>): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("cost_settings")
      .upsert(settings, { onConflict: "business_id" });
    if (error) fail("Failed to save the settings", error);
  },

  /**
   * Sets calculated prices a person confirmed and marks those products as
   * priced from the calculation. Returns how many prices were set.
   */
  async applyCalculatedPrices(
    prices: { id: Identifier; price: number }[],
  ): Promise<number> {
    const { data, error } = await getSupabaseClient().rpc(
      "apply_calculated_prices",
      { p_items: prices },
    );
    if (error) fail("Failed to set the prices", error);
    return data as number;
  },
};
