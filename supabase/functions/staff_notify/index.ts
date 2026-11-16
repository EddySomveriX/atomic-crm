import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import { sendStaffNotifications } from "../_shared/channels/staffNotifications.ts";

/**
 * Sends the queued messages to members about their bookings (new, moved,
 * cancelled) to the Telegram chats they linked.
 * Service role only (a scheduled job, or scripts/channels-dev.mjs).
 * → { sent, failed }
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST" || !(await isServiceRequest(req))) {
    return createErrorResponse(401, "Unauthorized");
  }
  try {
    return jsonResponse(await sendStaffNotifications());
  } catch (error) {
    console.error("staff notifications failed:", error);
    return createErrorResponse(500, "Sending failed");
  }
});
