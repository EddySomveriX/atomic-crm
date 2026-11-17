import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import { sendBookingReminder } from "../_shared/channels/reminders.ts";

/**
 * Booking reminders (TZ section 5.3).
 *
 * With the service role key (a scheduled job, or scripts/channels-dev.mjs):
 * sends every reminder that is due, 24 hours and 2 hours before. Each one is
 * claimed in the database before it is sent, so it never goes out twice.
 *
 * With a member's session, POST { booking_id }: sends a reminder of that
 * booking now (the "Send a reminder" button of the calendar).
 */

interface DueReminder {
  booking_id: number;
  kind: "24h" | "2h";
  conversation_id: number | null;
}

async function sendDue() {
  const { data, error } = await supabaseAdmin.rpc("claim_due_reminders");
  if (error) return createErrorResponse(500, error.message);
  const outcome = { sent: 0, no_chat: 0, failed: 0 };
  for (const due of (data ?? []) as DueReminder[]) {
    try {
      outcome[
        await sendBookingReminder(due.booking_id, due.kind, due.conversation_id)
      ]++;
    } catch (failure) {
      outcome.failed++;
      console.error(`reminder of booking ${due.booking_id} failed:`, failure);
    }
  }
  return jsonResponse(outcome);
}

async function sendNow(req: Request, user: User) {
  const context = await getBusinessContext(user.id);
  if (!context || context.role === "accountant") {
    return createErrorResponse(403, "Forbidden");
  }
  let payload: { booking_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id, conversation_id")
    .eq("id", Number(payload.booking_id))
    .eq("business_id", context.business_id)
    .maybeSingle();
  if (!booking) return createErrorResponse(404, "Booking not found");

  let conversationId: number | null = booking.conversation_id;
  if (conversationId == null && booking.client_id != null) {
    const { data: latest } = await supabaseAdmin
      .from("conversations")
      .select("id, channels!inner(kind)")
      .eq("business_id", context.business_id)
      .eq("client_id", booking.client_id)
      .neq("channels.kind", "widget")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    conversationId = latest?.id ?? null;
  }
  const result = await sendBookingReminder(booking.id, "now", conversationId);
  return jsonResponse({ result });
}

Deno.serve(async (req: Request) => {
  if (req.method === "POST" && (await isServiceRequest(req))) return sendDue();
  return OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        if (req.method !== "POST" || !user) {
          return createErrorResponse(405, "Method Not Allowed");
        }
        return sendNow(req, user);
      }),
    ),
  );
});
