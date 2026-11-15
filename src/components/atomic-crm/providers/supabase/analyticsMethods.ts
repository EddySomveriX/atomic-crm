import { HttpError } from "ra-core";

import type { Analytics } from "../../analytics/types";
import { getSupabaseClient } from "./supabase";

/** Figures of the analytics page, computed by the database. */
export const analyticsMethods = {
  async getAnalytics(from: Date, to: Date): Promise<Analytics> {
    const { data, error } = await getSupabaseClient().rpc(
      "business_analytics",
      { p_from: from.toISOString(), p_to: to.toISOString() },
    );
    if (error) {
      throw new HttpError(
        error.message ?? "Failed to load the analytics",
        400,
        error,
      );
    }
    return data as Analytics;
  },
};
