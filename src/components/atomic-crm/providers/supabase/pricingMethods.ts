import { HttpError, type Identifier } from "ra-core";

import type { PriceQuote } from "../../pricing/types";
import { getCurrentBusinessId } from "./authProvider";
import { getSupabaseClient } from "./supabase";

const fail = (message: string, error: { message?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/** Price list operations that are more than editing a row. */
export const pricingMethods = {
  /** Changes the prices of products by a percent; returns how many changed. */
  async changePrices(
    productIds: Identifier[],
    percent: number,
  ): Promise<number> {
    const { data, error } = await getSupabaseClient().rpc("change_prices", {
      p_product_ids: productIds,
      p_percent: percent,
    });
    if (error) fail("Failed to change the prices", error);
    return data as number;
  },

  /** What a service costs for a specialist, time, client and promo code. */
  async quotePrice(
    productId: Identifier,
    salesId: Identifier,
    startsAt: string,
    clientId?: Identifier | null,
    code?: string | null,
  ): Promise<PriceQuote | null> {
    const businessId = await getCurrentBusinessId();
    const { data, error } = await getSupabaseClient().rpc("price_quote", {
      p_business_id: businessId,
      p_product_id: productId,
      p_sales_id: salesId,
      p_starts_at: startsAt,
      p_client_id: clientId ?? null,
      p_code: code || null,
    });
    if (error) fail("Failed to price the booking", error);
    return ((data ?? []) as PriceQuote[])[0] ?? null;
  },
};
