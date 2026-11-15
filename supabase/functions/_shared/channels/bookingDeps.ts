import { supabaseAdmin } from "../supabaseAdmin.ts";
import {
  dayIn,
  type BookingRequest,
  type BotDeps,
  type BotService,
  type BotSpecialist,
  type FreeSlot,
} from "../bot/bookingFlow.ts";

export interface BusinessInfo {
  id: string;
  name: string;
  timezone: string;
}

export const loadBusiness = async (
  businessId: string,
): Promise<BusinessInfo> => {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, timezone")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return data as BusinessInfo;
};

/**
 * The database behind the booking dialog, for one business, with the service
 * role: bookable services, specialists with working hours, free slots
 * (public.free_slots) and new bookings, which the database refuses when the
 * time is no longer free (bookings_no_overlap, SQLSTATE 23P01).
 */
export const makeBookingDeps = (
  business: BusinessInfo,
  booking: { source: "telegram" | "widget"; conversationId: number | null },
): BotDeps => {
  let servicesCache: BotService[] | null = null;
  const specialistsCache = new Map<number, BotSpecialist[]>();

  return {
    businessName: business.name,
    timeZone: business.timezone,
    now: () => new Date(),

    async services() {
      if (servicesCache) return servicesCache;
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("id, name, duration_minutes")
        .eq("business_id", business.id)
        .eq("kind", "service")
        .eq("archived", false)
        .not("duration_minutes", "is", null)
        .order("name");
      if (error) throw error;
      servicesCache = (data ?? []) as BotService[];
      return servicesCache;
    },

    async specialists(serviceId: number) {
      const cached = specialistsCache.get(serviceId);
      if (cached) return cached;
      const { data: hours, error } = await supabaseAdmin
        .from("working_hours")
        .select("sales_id")
        .eq("business_id", business.id);
      if (error) throw error;
      const ids = [...new Set((hours ?? []).map((row) => row.sales_id))];
      if (ids.length === 0) return [];
      const { data: people, error: peopleError } = await supabaseAdmin
        .from("sales")
        .select("id, first_name, last_name, user_id")
        .in("id", ids);
      if (peopleError) throw peopleError;
      const { data: members, error: membersError } = await supabaseAdmin
        .from("members")
        .select("user_id")
        .eq("business_id", business.id)
        .eq("disabled", false);
      if (membersError) throw membersError;
      const active = new Set((members ?? []).map((member) => member.user_id));
      const specialists = (people ?? [])
        .filter((person) => active.has(person.user_id))
        .map((person) => ({
          id: person.id as number,
          name: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      specialistsCache.set(serviceId, specialists);
      return specialists;
    },

    async freeSlots(serviceId: number, day: string, salesId: number | null) {
      const { data, error } = await supabaseAdmin.rpc("free_slots", {
        p_business_id: business.id,
        p_product_id: serviceId,
        p_day: day,
        p_sales_id: salesId,
      });
      if (error) throw error;
      return (data ?? []) as FreeSlot[];
    },

    async book(request: BookingRequest) {
      // Clients only book offered times: within the working hours and free
      const day = dayIn(new Date(request.startsAt), business.timezone);
      const offered = await this.freeSlots(
        request.serviceId,
        day,
        request.salesId,
      );
      const wanted = Date.parse(request.startsAt);
      if (!offered.some((slot) => Date.parse(slot.starts_at) === wanted)) {
        return "taken";
      }
      const { error } = await supabaseAdmin.from("bookings").insert({
        business_id: business.id,
        sales_id: request.salesId,
        product_id: request.serviceId,
        client_id: request.clientId,
        starts_at: request.startsAt,
        source: booking.source,
        conversation_id: booking.conversationId,
      });
      if (error?.code === "23P01") return "taken";
      if (error) throw error;
      return "booked";
    },

    async findOrCreateClient(name: string, phone: string) {
      const { data, error } = await supabaseAdmin.rpc("find_or_create_client", {
        p_business_id: business.id,
        p_name: name,
        p_phone: phone,
      });
      if (error) throw error;
      return data as number;
    },
  };
};
