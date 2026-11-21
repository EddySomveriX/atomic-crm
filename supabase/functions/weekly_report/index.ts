import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import { loadBotToken } from "../_shared/channels/delivery.ts";
import type { BotLanguage } from "../_shared/bot/botTexts.ts";
import { addDays, dayIn } from "../_shared/bot/flowShared.ts";
import {
  buildReport,
  type ReportAnalytics,
} from "../_shared/weeklyReport/reportText.ts";
import {
  duePeriod,
  lastSevenDays,
  startOfDay,
  type ReportPeriod,
} from "../_shared/weeklyReport/schedule.ts";
import { sendMessage } from "../../../connectors/telegram/index.ts";

/**
 * The weekly report of a business in Telegram (schemas/29_weekly_report.sql).
 * - From the server (a scheduled job, or scripts/channels-dev.mjs): sends
 *   every report that is due. → { sent, failed }
 * - From the owner in the app ("send now"): sends the report of the last
 *   seven days to the chosen members at once.
 *   → { sent, failed, no_chat } or { status: "no_recipients" | "no_bot" }
 */

interface Settings {
  business_id: string;
  weekday: number;
  hour: number;
  recipients: number[];
  last_sent_week: string | null;
  businesses: {
    name: string;
    timezone: string;
    country_code: string | null;
  } | null;
}

interface Delivery {
  sent: number;
  failed: number;
  no_chat: number;
}

const SETTINGS_COLUMNS =
  "business_id, weekday, hour, recipients, last_sent_week, businesses(name, timezone, country_code)";

const analyticsOf = async (
  businessId: string,
  firstDay: string,
  endDay: string,
  timeZone: string,
): Promise<ReportAnalytics> => {
  const { data, error } = await supabaseAdmin.rpc("business_analytics_for", {
    p_business_id: businessId,
    p_from: startOfDay(firstDay, timeZone).toISOString(),
    p_to: startOfDay(endDay, timeZone).toISOString(),
  });
  if (error) throw error;
  return data as ReportAnalytics;
};

const reportFor = async (settings: Settings, period: ReportPeriod) => {
  const business = settings.businesses!;
  const timeZone = business.timezone;
  const today = dayIn(new Date(), timeZone);
  const [current, previous, upcoming] = await Promise.all([
    analyticsOf(settings.business_id, period.firstDay, period.endDay, timeZone),
    analyticsOf(
      settings.business_id,
      addDays(period.firstDay, -7),
      period.firstDay,
      timeZone,
    ),
    analyticsOf(settings.business_id, today, addDays(today, 7), timeZone),
  ]);
  const language: BotLanguage =
    !business.country_code || business.country_code === "UA" ? "uk" : "en";
  return buildReport({
    businessName: business.name,
    language,
    period,
    current,
    previous,
    upcoming,
  });
};

/** Sends a text through the bot of the business to the members' chats. */
const deliver = async (
  businessId: string,
  recipients: number[],
  text: string,
): Promise<Delivery | null> => {
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("business_id", businessId)
    .eq("kind", "telegram")
    .eq("enabled", true)
    .maybeSingle();
  if (!channel) return null;
  const { data: chats } = await supabaseAdmin
    .from("staff_telegram")
    .select("sales_id, chat_id")
    .eq("business_id", businessId)
    .in("sales_id", recipients);
  const linked = chats ?? [];
  const botToken = await loadBotToken(channel.id);
  const outcome: Delivery = {
    sent: 0,
    failed: 0,
    no_chat: recipients.length - linked.length,
  };
  for (const chat of linked) {
    try {
      await sendMessage(chat.chat_id, text, undefined, {
        fetch,
        settings: { botToken: botToken ?? undefined },
      });
      outcome.sent++;
    } catch (error) {
      console.error("weekly report not delivered:", error);
      outcome.failed++;
    }
  }
  return outcome;
};

const sendDue = async () => {
  const { data, error } = await supabaseAdmin
    .from("weekly_reports")
    .select(SETTINGS_COLUMNS)
    .eq("enabled", true)
    .limit(500);
  if (error) throw error;
  const outcome = { sent: 0, failed: 0 };
  const now = new Date();
  for (const settings of (data ?? []) as unknown as Settings[]) {
    if (!settings.businesses || settings.recipients.length === 0) continue;
    const period = duePeriod(now, settings, settings.businesses.timezone);
    if (!period) continue;
    try {
      const text = await reportFor(settings, period);
      const delivery = await deliver(
        settings.business_id,
        settings.recipients,
        text,
      );
      outcome.sent += delivery?.sent ?? 0;
      outcome.failed += delivery?.failed ?? 0;
    } catch (reportError) {
      console.error("weekly report failed:", reportError);
      outcome.failed++;
    }
    // Once a week, delivered or not: a failure is not retried every minute
    await supabaseAdmin
      .from("weekly_reports")
      .update({ last_sent_week: period.firstDay })
      .eq("business_id", settings.business_id);
  }
  return outcome;
};

const sendNow = async (user: User) => {
  const context = await getBusinessContext(user.id);
  if (context?.role !== "owner") return createErrorResponse(403, "Forbidden");
  const { data } = await supabaseAdmin
    .from("weekly_reports")
    .select(SETTINGS_COLUMNS)
    .eq("business_id", context.business_id)
    .maybeSingle();
  const settings = data as unknown as Settings | null;
  if (!settings?.businesses || settings.recipients.length === 0) {
    return jsonResponse({ status: "no_recipients" });
  }
  const text = await reportFor(
    settings,
    lastSevenDays(new Date(), settings.businesses.timezone),
  );
  const delivery = await deliver(
    settings.business_id,
    settings.recipients,
    text,
  );
  return jsonResponse(delivery ?? { status: "no_bot" });
};

Deno.serve(async (req: Request) => {
  if (req.method === "POST" && (await isServiceRequest(req))) {
    try {
      return jsonResponse(await sendDue());
    } catch (error) {
      console.error("weekly reports failed:", error);
      return createErrorResponse(500, "Sending failed");
    }
  }
  return OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        if (req.method !== "POST" || !user) {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await sendNow(user);
        } catch (error) {
          console.error("weekly report failed:", error);
          return createErrorResponse(500, "Sending failed");
        }
      }),
    ),
  );
});
