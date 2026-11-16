import { supabaseAdmin } from "../supabaseAdmin.ts";
import type {
  BotDeps,
  FreeSlot,
  ReliabilityLevel,
  UpcomingBooking,
} from "../bot/flowShared.ts";

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/**
 * What a client does with their own bookings through a channel, for one
 * business, with the service role: every call checks that the booking is the
 * client's, in this business and still ahead. Cancelling records that the
 * client cancelled (the database decides whether it was late); moving is
 * allowed only to a time the bot offered.
 */
export const makeClientBookingDeps = (
  businessId: string,
): Pick<
  BotDeps,
  "upcoming" | "cancel" | "confirm" | "reschedule" | "reliability"
> => {
  const own = (bookingId: number, clientId: number) =>
    supabaseAdmin
      .from("bookings")
      .select("id, product_id, starts_at")
      .eq("id", bookingId)
      .eq("business_id", businessId)
      .eq("client_id", clientId)
      .eq("status", "booked")
      .gt("starts_at", new Date().toISOString())
      .maybeSingle();

  return {
    async upcoming(clientId: number): Promise<UpcomingBooking[]> {
      const { data, error } = await supabaseAdmin
        .from("bookings")
        .select(
          "id, product_id, sales_id, starts_at, products(name), sales(first_name, last_name)",
        )
        .eq("business_id", businessId)
        .eq("client_id", clientId)
        .eq("status", "booked")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const product = one(row.products as unknown as { name: string });
        const person = one(
          row.sales as unknown as { first_name: string; last_name: string },
        );
        return {
          id: row.id,
          serviceId: row.product_id,
          serviceName: product?.name ?? "",
          salesId: row.sales_id,
          specialistName:
            `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim(),
          startsAt: row.starts_at,
        };
      });
    },

    async cancel(bookingId: number, clientId: number) {
      const { data } = await own(bookingId, clientId);
      if (!data) return "not_found";
      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "cancelled", cancelled_by: "client" })
        .eq("id", bookingId);
      if (error) throw error;
      return "cancelled";
    },

    async confirm(bookingId: number, clientId: number) {
      const { data } = await own(bookingId, clientId);
      if (!data) return "not_found";
      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
      return "confirmed";
    },

    async reschedule(bookingId: number, clientId: number, slot: FreeSlot) {
      const { data: booking } = await own(bookingId, clientId);
      if (!booking) return "not_found";
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("timezone")
        .eq("id", businessId)
        .single();
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: business?.timezone ?? "Europe/Kyiv",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(slot.starts_at));
      const { data: offered, error: slotsError } = await supabaseAdmin.rpc(
        "free_slots",
        {
          p_business_id: businessId,
          p_product_id: booking.product_id,
          p_day: day,
          p_sales_id: slot.sales_id,
        },
      );
      if (slotsError) throw slotsError;
      const wanted = Date.parse(slot.starts_at);
      if (
        !((offered ?? []) as FreeSlot[]).some(
          (item) => Date.parse(item.starts_at) === wanted,
        )
      ) {
        return "taken";
      }
      const { error } = await supabaseAdmin
        .from("bookings")
        .update({
          starts_at: new Date(wanted).toISOString(),
          sales_id: slot.sales_id,
        })
        .eq("id", bookingId);
      if (error?.code === "23P01") return "taken";
      if (error) throw error;
      return "moved";
    },

    async reliability(clientId: number): Promise<ReliabilityLevel> {
      // The view filters by the current business of a signed-in member; the
      // server reads the same counts for this business directly
      const { data: client } = await supabaseAdmin
        .from("client_reliability")
        .select("level")
        .eq("id", clientId)
        .eq("business_id", businessId)
        .maybeSingle();
      return (client?.level as ReliabilityLevel) ?? "regular";
    },
  };
};
