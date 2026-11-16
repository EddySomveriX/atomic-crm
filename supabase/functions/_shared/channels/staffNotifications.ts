import { supabaseAdmin } from "../supabaseAdmin.ts";
import { botText, formatWhen, type BotLanguage } from "../bot/botTexts.ts";
import { loadBotToken } from "./delivery.ts";
import { sendMessage } from "../../../../connectors/telegram/index.ts";

/**
 * Messages to members about their bookings (supabase/schemas/23_team.sql):
 * a trigger queues them in staff_notifications, this sends them through the
 * Telegram bot of the business to the chat the member linked.
 */

interface PendingNotification {
  id: number;
  business_id: string;
  sales_id: number;
  kind: "new" | "moved" | "cancelled";
  bookings: {
    starts_at: string;
    products: { name: string } | null;
    companies: { name: string } | null;
  } | null;
  businesses: { timezone: string; country_code: string | null } | null;
}

const TEXT_KEYS = {
  new: "staff_new",
  moved: "staff_moved",
  cancelled: "staff_cancelled",
} as const;

/** Notifications older than this are dropped instead of sent late. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export const sendStaffNotifications = async (): Promise<{
  sent: number;
  failed: number;
}> => {
  const { data, error } = await supabaseAdmin
    .from("staff_notifications")
    .select(
      "id, business_id, sales_id, kind, created_at, bookings(starts_at, products(name), companies(name)), businesses(timezone, country_code)",
    )
    .eq("status", "pending")
    .order("created_at")
    .limit(50);
  if (error) throw error;
  const outcome = { sent: 0, failed: 0 };

  for (const row of (data ?? []) as unknown as (PendingNotification & {
    created_at: string;
  })[]) {
    let status: "sent" | "failed" = "sent";
    let failure: string | null = null;
    try {
      if (Date.now() - new Date(row.created_at).getTime() > STALE_AFTER_MS) {
        throw new Error("stale");
      }
      const { data: chat } = await supabaseAdmin
        .from("staff_telegram")
        .select("chat_id")
        .eq("business_id", row.business_id)
        .eq("sales_id", row.sales_id)
        .maybeSingle();
      const { data: channel } = await supabaseAdmin
        .from("channels")
        .select("id")
        .eq("business_id", row.business_id)
        .eq("kind", "telegram")
        .eq("enabled", true)
        .maybeSingle();
      if (!chat || !channel || !row.bookings) throw new Error("no chat");
      const language: BotLanguage =
        row.businesses?.country_code === "UA" || !row.businesses?.country_code
          ? "uk"
          : "en";
      const text = botText(language, TEXT_KEYS[row.kind], {
        service: row.bookings.products?.name ?? "",
        when: formatWhen(
          new Date(row.bookings.starts_at),
          row.businesses?.timezone ?? "Europe/Kyiv",
          language,
        ),
        client:
          row.bookings.companies?.name ?? botText(language, "staff_no_client"),
      });
      const botToken = await loadBotToken(channel.id);
      await sendMessage(chat.chat_id, text, undefined, {
        fetch,
        settings: { botToken: botToken ?? undefined },
      });
    } catch (sendError) {
      status = "failed";
      failure = sendError instanceof Error ? sendError.message : "send failed";
    }
    await supabaseAdmin
      .from("staff_notifications")
      .update({
        status,
        error: failure,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    outcome[status]++;
  }
  return outcome;
};
