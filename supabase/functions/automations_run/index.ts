import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import {
  sendClaimedAutomation,
  type ClaimedAutomation,
} from "../_shared/channels/automations.ts";

/**
 * Automatic messages to clients: claims every message that is due (each one
 * once) and sends it to the client's Telegram chat.
 * Service role only (a scheduled job, or scripts/channels-dev.mjs).
 * → { sent, failed }
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST" || !(await isServiceRequest(req))) {
    return createErrorResponse(401, "Unauthorized");
  }
  const { data, error } = await supabaseAdmin.rpc("claim_due_automations");
  if (error) return createErrorResponse(500, error.message);
  const outcome = { sent: 0, failed: 0 };
  for (const claimed of (data ?? []) as ClaimedAutomation[]) {
    try {
      outcome[await sendClaimedAutomation(claimed)]++;
    } catch (failure) {
      outcome.failed++;
      console.error(`automatic message ${claimed.send_id} failed:`, failure);
      await supabaseAdmin
        .from("automation_sends")
        .update({ status: "failed", error: "send failed" })
        .eq("id", claimed.send_id);
    }
  }
  return jsonResponse(outcome);
});
