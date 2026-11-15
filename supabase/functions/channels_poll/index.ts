import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import type { ChannelRow } from "../_shared/channels/delivery.ts";
import { handleTelegramUpdate } from "../_shared/channels/telegramUpdates.ts";
import { getUpdates } from "../../../connectors/telegram/index.ts";

/**
 * Fetches new Telegram updates of every connected bot and processes them:
 * the way to receive messages on a developer machine, which Telegram cannot
 * reach with a webhook. Called by scripts/channels-dev.mjs with the service
 * role key. A bot with a webhook set is skipped by Telegram (409).
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return createErrorResponse(405, "Method Not Allowed");
  if (!(await isServiceRequest(req)))
    return createErrorResponse(401, "Unauthorized");

  const { data: channels, error } = await supabaseAdmin
    .from("channels")
    .select(
      "id, business_id, kind, name, enabled, channel_secrets(bot_token, update_offset)",
    )
    .eq("kind", "telegram")
    .eq("enabled", true);
  if (error) return createErrorResponse(500, error.message);

  let processed = 0;
  const failures: string[] = [];
  for (const row of channels ?? []) {
    const secrets = Array.isArray(row.channel_secrets)
      ? row.channel_secrets[0]
      : row.channel_secrets;
    if (!secrets?.bot_token) continue;
    const context = { fetch, settings: { botToken: secrets.bot_token } };
    try {
      const updates = await getUpdates(
        Number(secrets.update_offset ?? 0),
        context,
      );
      for (const update of updates) {
        await handleTelegramUpdate(
          row as unknown as ChannelRow,
          secrets.bot_token,
          update,
        );
        processed++;
        await supabaseAdmin
          .from("channel_secrets")
          .update({ update_offset: update.update_id + 1 })
          .eq("channel_id", row.id);
      }
    } catch (failure) {
      failures.push(
        `channel ${row.id}: ${failure instanceof Error ? failure.message : "failed"}`,
      );
    }
  }
  if (failures.length) console.error(failures.join("; "));
  return jsonResponse({ processed, failures: failures.length });
});
