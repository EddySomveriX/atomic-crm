import { HttpError, type Identifier } from "ra-core";

import type { DayTotals, TeamReportRow } from "../../team/types";
import type {
  WeeklyReportSettings,
  WeeklyReportSendResult,
} from "../../automations/weeklyReport";
import { invoke } from "./channelMethods";
import { getSupabaseClient } from "./supabase";

const fail = (message: string, error: { message?: string; code?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/** The team: Telegram link codes, commissions, the report, closing a day. */
export const teamMethods = {
  /** A one-time code the member sends to the bot (valid 15 minutes). */
  async createStaffLinkCode(): Promise<string> {
    const { data, error } = await getSupabaseClient().rpc(
      "create_staff_link_code",
    );
    if (error) fail("Failed to make a code", error);
    return data as string;
  },

  /** Unlinks a member's Telegram (their own, or anyone's for an owner). */
  async unlinkStaffTelegram(salesId: Identifier): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("staff_telegram")
      .delete()
      .eq("sales_id", salesId);
    if (error) fail("Failed to unlink", error);
  },

  /** Linked Telegram chats of the team (sales ids). */
  async getStaffTelegram(): Promise<Identifier[]> {
    const { data, error } = await getSupabaseClient()
      .from("staff_telegram")
      .select("sales_id");
    if (error) fail("Failed to load", error);
    return (data ?? []).map((row) => row.sales_id as Identifier);
  },

  async setMemberCommission(
    salesId: Identifier,
    percent: number | null,
  ): Promise<void> {
    const { error } = await getSupabaseClient().rpc("set_member_commission", {
      p_sales_id: salesId,
      p_percent: percent,
    });
    if (error) fail("Failed to save the commission", error);
  },

  /** Visits, revenue and commission per specialist, days included. */
  async getTeamReport(from: string, to: string): Promise<TeamReportRow[]> {
    const { data, error } = await getSupabaseClient().rpc("team_report", {
      p_from: from,
      p_to: to,
    });
    if (error) fail("Failed to load the report", error);
    return (data ?? []) as TeamReportRow[];
  },

  /**
   * Closes a day; HttpError with body.code "P0001" when some visits of the
   * day are not marked.
   */
  async closeDay(day: string): Promise<DayTotals> {
    const { data, error } = await getSupabaseClient().rpc("close_day", {
      p_day: day,
    });
    if (error) fail("Failed to close the day", error);
    return data as DayTotals;
  },

  /** Settings of the weekly report in Telegram, or null before the first save. */
  async getWeeklyReport(): Promise<WeeklyReportSettings | null> {
    const { data, error } = await getSupabaseClient()
      .from("weekly_reports")
      .select("enabled, weekday, hour, recipients")
      .maybeSingle();
    if (error) fail("Failed to load", error);
    return (data as WeeklyReportSettings | null) ?? null;
  },

  async saveWeeklyReport(settings: WeeklyReportSettings): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("weekly_reports")
      .upsert(settings, { onConflict: "business_id" });
    if (error) fail("Failed to save", error);
  },

  /** Sends the report of the last seven days to the chosen members now. */
  sendWeeklyReportNow(): Promise<WeeklyReportSendResult> {
    return invoke<WeeklyReportSendResult>("weekly_report", "POST", {});
  },
};
