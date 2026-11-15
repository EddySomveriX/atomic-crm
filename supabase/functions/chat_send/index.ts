import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import { deliverText, type ChannelRow } from "../_shared/channels/delivery.ts";

/**
 * An answer of a member to a client, from the chat center (TZ section 5.2).
 * POST { conversation_id, text } → { status: "sent" | "failed", error? }
 * The conversation must belong to the member's current business; the message
 * goes out through its channel and is recorded with its author.
 */

const MAX_LENGTH = 4096;

async function send(req: Request, user: User) {
  const context = await getBusinessContext(user.id);
  if (!context || context.role === "accountant") {
    return createErrorResponse(403, "Forbidden");
  }
  let payload: { conversation_id?: unknown; text?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text || text.length > MAX_LENGTH) {
    return createErrorResponse(400, "text is required (up to 4096 characters)");
  }
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, business_id, channel_id, external_id, channels(kind, enabled)")
    .eq("id", Number(payload.conversation_id))
    .eq("business_id", context.business_id)
    .maybeSingle();
  if (!conversation) return createErrorResponse(404, "Conversation not found");
  const channel = (
    Array.isArray(conversation.channels)
      ? conversation.channels[0]
      : conversation.channels
  ) as Pick<ChannelRow, "kind" | "enabled">;

  const sale = await getUserSale(user);
  const result = await deliverText(conversation, channel, text, {
    salesId: sale?.id ?? null,
  });
  return jsonResponse({ status: result.status, error: result.error });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        if (req.method !== "POST" || !user) {
          return createErrorResponse(405, "Method Not Allowed");
        }
        return send(req, user);
      }),
    ),
  ),
);
