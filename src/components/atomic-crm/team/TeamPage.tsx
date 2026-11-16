import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { dayIn } from "../booking/bookingTime";
import { useBusinessTimeZone } from "../booking/useBookingData";
import { formatMoney } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { MyTelegram } from "./MyTelegram";
import { TEAM_PERIODS, periodDays, type TeamPeriod } from "./period";
import { parsePercent, type TeamReportRow } from "./types";

/**
 * The team: each member links their Telegram for messages about their
 * bookings; owners and managers see visits, revenue and commission of every
 * specialist for a period, others only their own; an owner sets the percent.
 */
export const TeamPage = () => {
  const translate = useTranslate();
  const timeZone = useBusinessTimeZone();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requested = params.get("period") as TeamPeriod | null;
  const period: TeamPeriod =
    requested && TEAM_PERIODS.includes(requested) ? requested : "month";
  const { from, to } = periodDays(period, dayIn(new Date(), timeZone));

  const { data: report = [], isPending } = useQuery({
    queryKey: ["team_report", from, to],
    queryFn: () => dataProvider.getTeamReport(from, to),
  });
  const { data: linked = [] } = useQuery({
    queryKey: ["staff_telegram"],
    queryFn: () => dataProvider.getStaffTelegram(),
  });
  const refreshLinked = () =>
    queryClient.invalidateQueries({ queryKey: ["staff_telegram"] });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <h1 className="text-2xl font-semibold">{translate("crm.team.title")}</h1>
      <MyTelegram linkedIds={linked} onChange={refreshLinked} />

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TEAM_PERIODS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={period === item}
            onClick={() => setParams({ period: item }, { replace: true })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              period === item
                ? "border-primary bg-accent font-medium"
                : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            {translate(`crm.team.periods.${item}`)}
          </button>
        ))}
      </div>

      {isPending ? null : (
        <TeamReport
          rows={report}
          linked={linked}
          onSaved={() =>
            queryClient.invalidateQueries({ queryKey: ["team_report"] })
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        {translate("crm.team.report_hint")}
      </p>
    </div>
  );
};

TeamPage.path = "/team";

const TeamReport = ({
  rows,
  linked,
  onSaved,
}: {
  rows: TeamReportRow[];
  linked: readonly (string | number)[];
  onSaved: () => void;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  const commission = rows.reduce((sum, row) => sum + Number(row.commission), 0);

  return (
    <section className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-sm text-muted-foreground">
            {translate("crm.team.revenue")}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">
            {money(revenue)}
          </dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-sm text-muted-foreground">
            {translate("crm.team.commission")}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">
            {money(commission)}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.sales_id} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="truncate">
                  {`${row.first_name} ${row.last_name}`.trim()}
                </span>
                {linked.includes(row.sales_id) ? (
                  <Send
                    className="size-3.5 shrink-0 text-primary"
                    aria-label={translate("crm.team.has_telegram")}
                  />
                ) : null}
              </span>
              <span className="block text-xs text-muted-foreground">
                {translate("crm.team.visits", {
                  smart_count: Number(row.visits),
                })}
                {Number(row.no_shows) > 0
                  ? `, ${translate("crm.team.no_shows", { smart_count: Number(row.no_shows) })}`
                  : ""}
                , {money(Number(row.revenue))}
              </span>
            </span>
            <CommissionInput row={row} onSaved={onSaved} />
            <span className="w-24 shrink-0 text-right font-medium tabular-nums">
              {money(Number(row.commission))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const CommissionInput = ({
  row,
  onSaved,
}: {
  row: TeamReportRow;
  onSaved: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { canAccess: isOwner } = useCanAccess({
    resource: "sales",
    action: "edit",
  });
  const saved =
    row.commission_percent == null ? "" : String(row.commission_percent);
  const [value, setValue] = useState(saved);

  if (!isOwner) {
    return (
      <span className="w-14 shrink-0 text-right text-sm text-muted-foreground">
        {saved ? `${saved}%` : "—"}
      </span>
    );
  }
  const save = async () => {
    if (value.trim() === saved) return;
    const percent = value.trim() === "" ? null : parsePercent(value);
    if (value.trim() !== "" && percent == null) {
      notify("crm.team.percent_invalid", { type: "warning" });
      setValue(saved);
      return;
    }
    try {
      await dataProvider.setMemberCommission(row.sales_id, percent);
      onSaved();
    } catch {
      setValue(saved);
      notify("crm.team.failed", { type: "error" });
    }
  };
  return (
    <label className="flex shrink-0 items-center gap-1 text-sm">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        inputMode="decimal"
        placeholder="—"
        className="h-8 w-14 text-right"
        aria-label={translate("crm.team.percent_label", {
          name: row.first_name,
        })}
      />
      %
    </label>
  );
};
