import { Armchair, DoorOpen, Package, RotateCcw, Wallet } from "lucide-react";
import { useTranslate } from "ra-core";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { useCalmMode } from "../appearance/calmMode";
import { formatMoney } from "../money/money";
import { ErrorState, LoadingRows } from "../misc/PageStates";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { BOARD_LAYOUT, Token, TokenRow, Zone } from "./BoardParts";
import {
  ZONES,
  isBusyNow,
  zonesNeedingAttention,
  type ZoneKey,
} from "./boardLogic";
import { LevelBar } from "./LevelBar";
import { specialistName } from "../booking/types";
import { useBusinessMap } from "./useBusinessMap";
import { ZoneDetails } from "./ZoneDetails";

const ICONS = {
  entrance: DoorOpen,
  hall: Armchair,
  cash: Wallet,
  stock: Package,
  return: RotateCcw,
} as const;

const isZone = (value: string | null): value is ZoneKey =>
  (ZONES as readonly string[]).includes(value ?? "");

/**
 * The business on one board, like a board game: clients come in, meet the
 * team in the hall, pay at the cash desk, the stock feeds the work, and
 * those who stopped coming wait to be called back. Built from this month's
 * real figures; a zone opens its people and the one thing to do there.
 */
export const BusinessMapPage = () => {
  const translate = useTranslate();
  const { locale } = useConfigurationContext();
  const [isCalm] = useCalmMode();
  const [params, setParams] = useSearchParams();
  const selected = params.get("zone");
  const map = useBusinessMap();
  const { analytics, rememberPoints } = map;
  const animated = !isCalm;
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(`crm.business_map.${key}`, options);

  useEffect(() => {
    if (analytics) rememberPoints();
  }, [analytics, rememberPoints]);

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">
        {translate("crm.nav.business_map")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {map.businessName
          ? t("subtitle", { name: map.businessName })
          : t("subtitle_plain")}
      </p>
    </div>
  );

  if (map.error) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
        {header}
        <ErrorState message={t("failed")} onRetry={map.retry} />
      </div>
    );
  }
  if (map.isPending || !analytics) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
        {header}
        <LoadingRows rows={5} />
      </div>
    );
  }

  const money = (minor: number) =>
    formatMoney(minor, analytics.currency, locale, { compact: true });
  const attention = zonesNeedingAttention(analytics);
  const now = new Date();
  const select = (zone: ZoneKey) =>
    setParams(selected === zone ? {} : { zone }, { replace: true });
  const zoneProps = (zone: ZoneKey, step: number) => ({
    zone,
    step,
    icon: ICONS[zone],
    title: t(`zones.${zone}.title`),
    needsAttention: attention.includes(zone),
    isSelected: selected === zone,
    onSelect: () => select(zone),
  });
  const expenses = analytics.kpis.materials_cost + (map.overheadMonthly ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      {header}
      {isCalm ? null : <LevelBar points={map.points} />}

      <div
        className={`${BOARD_LAYOUT} rounded-3xl border bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] p-3 [background-size:16px_16px]`}
      >
        <Zone
          {...zoneProps("entrance", 1)}
          status={
            <>
              {t("new_week", { smart_count: map.newClientsTotal })}
              <br />
              {t("waiting", { smart_count: analytics.kpis.waiting_now })}
            </>
          }
        >
          <TokenRow
            names={map.newClients.map((client) => client.name)}
            total={map.newClientsTotal}
            animated={animated}
          />
        </Zone>

        <Zone
          {...zoneProps("hall", 2)}
          status={t("bookings_today", { smart_count: map.bookings.length })}
        >
          {map.specialists.map((member) => (
            <Token
              key={String(member.id)}
              name={specialistName(member)}
              kind="team"
              isBusy={isBusyNow(map.bookings, member.id, now)}
              badge={
                map.bookings.filter(
                  (booking) => String(booking.sales_id) === String(member.id),
                ).length || undefined
              }
              animated={animated}
            />
          ))}
        </Zone>

        <Zone
          {...zoneProps("cash", 3)}
          status={
            <>
              <span className="block text-xl font-semibold text-foreground tabular-nums">
                + {money(analytics.kpis.revenue)}
              </span>
              {t("expenses_month", { value: money(expenses) })}
            </>
          }
        />

        <Zone
          {...zoneProps("stock", 4)}
          status={
            <>
              {t("products_short", { smart_count: analytics.stock.products })}
              <br />
              {t("out_of_stock_short", {
                smart_count: analytics.stock.out_of_stock,
              })}
              <br />
              {t("suppliers", { smart_count: map.suppliersTotal })}
            </>
          }
        />

        <Zone
          {...zoneProps("return", 5)}
          status={t("dormant", {
            smart_count: analytics.dormant_clients.length,
          })}
        >
          <TokenRow
            names={analytics.dormant_clients.map((client) => client.name)}
            animated={animated}
          />
        </Zone>
      </div>

      {isZone(selected) ? (
        <ZoneDetails
          zone={selected}
          analytics={analytics}
          specialists={map.specialists}
          bookings={map.bookings}
          newClients={map.newClients}
          money={(minor) => formatMoney(minor, analytics.currency, locale)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("tap_hint")}{" "}
          <Link to="/analytics" className="text-primary hover:underline">
            {t("open_analytics")}
          </Link>
        </p>
      )}
    </div>
  );
};

BusinessMapPage.path = "/business-map";
