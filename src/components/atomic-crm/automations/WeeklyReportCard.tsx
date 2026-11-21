import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartNoAxesColumn, Send } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { specialistName } from "../booking/types";
import { useSpecialists } from "../booking/useBookingData";
import type { CrmDataProvider } from "../providers/types";
import {
  DEFAULT_WEEKLY_REPORT,
  HOURS,
  WEEKDAYS,
  toggleRecipient,
  weekdayName,
  type WeeklyReportSendResult,
  type WeeklyReportSettings,
} from "./weeklyReport";

const QUERY_KEY = ["weekly_report"];
const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * The weekly report in Telegram: on the day and hour the owner picks, the
 * bot sends the chosen members the week's money, visits, clients, the
 * busiest specialists and services, and what to do next.
 */
export const WeeklyReportCard = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { canAccess: isOwner } = useCanAccess({
    resource: "sales",
    action: "edit",
  });
  const { data: saved, isPending } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => dataProvider.getWeeklyReport(),
  });
  const settings = saved ?? DEFAULT_WEEKLY_REPORT;

  const save = async (change: Partial<WeeklyReportSettings>) => {
    const next = { ...settings, ...change };
    queryClient.setQueryData(QUERY_KEY, next);
    try {
      await dataProvider.saveWeeklyReport(next);
    } catch {
      notify("crm.weekly_report.save_failed", { type: "error" });
    }
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <ChartNoAxesColumn className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {translate("crm.weekly_report.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.weekly_report.hint")}
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          disabled={!isOwner || isPending}
          aria-label={translate("crm.weekly_report.title")}
          onCheckedChange={(enabled) => save({ enabled })}
        />
      </div>
      {settings.enabled ? (
        <WeeklyReportOptions
          settings={settings}
          disabled={!isOwner}
          onChange={save}
        />
      ) : null}
      {!isOwner ? (
        <p className="text-xs text-muted-foreground">
          {translate("crm.weekly_report.owner_only")}
        </p>
      ) : null}
    </section>
  );
};

const WeeklyReportOptions = ({
  settings,
  disabled,
  onChange,
}: {
  settings: WeeklyReportSettings;
  disabled: boolean;
  onChange: (change: Partial<WeeklyReportSettings>) => void;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { specialists } = useSpecialists();
  const { data: linked = [] } = useQuery({
    queryKey: ["staff_telegram"],
    queryFn: () => dataProvider.getStaffTelegram(),
  });
  const isLinked = (id: unknown) =>
    linked.some((item) => String(item) === String(id));

  return (
    <div className="flex flex-col gap-4 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        <Select
          value={String(settings.weekday)}
          disabled={disabled}
          onValueChange={(value) => onChange({ weekday: Number(value) })}
        >
          <SelectTrigger
            className="w-44"
            aria-label={translate("crm.weekly_report.day")}
          >
            <SelectValue>{weekdayName(settings.weekday, locale)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {WEEKDAYS.map((weekday) => (
              <SelectItem key={weekday} value={String(weekday)}>
                {weekdayName(weekday, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(settings.hour)}
          disabled={disabled}
          onValueChange={(value) => onChange({ hour: Number(value) })}
        >
          <SelectTrigger
            className="w-28"
            aria-label={translate("crm.weekly_report.hour")}
          >
            <SelectValue>{pad(settings.hour)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((hour) => (
              <SelectItem key={hour} value={String(hour)}>
                {pad(hour)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {translate("crm.weekly_report.recipients")}
        </legend>
        {specialists.map((member) => {
          const checked = settings.recipients.some(
            (id) => String(id) === String(member.id),
          );
          return (
            <label
              key={String(member.id)}
              className="flex items-center gap-3 text-sm"
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() =>
                  onChange({
                    recipients: toggleRecipient(settings.recipients, member.id),
                  })
                }
              />
              <span className="flex-1">{specialistName(member)}</span>
              {isLinked(member.id) ? null : (
                <span className="text-xs text-muted-foreground">
                  {translate("crm.weekly_report.no_telegram")}
                </span>
              )}
            </label>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {translate("crm.weekly_report.link_hint")}{" "}
          <Link
            to="/team"
            className="text-primary underline-offset-4 hover:underline"
          >
            {translate("crm.weekly_report.link_action")}
          </Link>
        </p>
      </fieldset>

      {disabled ? null : <SendNowButton />}
    </div>
  );
};

const resultMessage = (result: WeeklyReportSendResult) => {
  if ("status" in result) return `crm.weekly_report.${result.status}`;
  if (result.sent > 0) return "crm.weekly_report.sent";
  return "crm.weekly_report.nobody_linked";
};

const SendNowButton = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    setIsSending(true);
    try {
      const result = await dataProvider.sendWeeklyReportNow();
      const sent = "sent" in result && result.sent > 0;
      notify(resultMessage(result), {
        type: sent ? "success" : "warning",
        messageArgs: { smart_count: "sent" in result ? result.sent : 0 },
      });
    } catch {
      notify("crm.weekly_report.send_failed", { type: "error" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="self-start"
      disabled={isSending}
      onClick={send}
    >
      <Send />
      {translate("crm.weekly_report.send_now")}
    </Button>
  );
};
