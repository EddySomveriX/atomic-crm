import { useState, type ReactNode } from "react";
import { useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

/**
 * Small charts of the analytics page, drawn with plain elements so that they
 * follow the theme and stay readable on a phone. Colors come from the
 * validated --series-* and --seq-* variables of index.css; every chart has a
 * legend or a title naming its one series, and a table view.
 */

export interface Series {
  key: string;
  label: string;
  /** CSS color: one of var(--series-1..3) */
  color: string;
}

export interface StackedRow {
  label: string;
  values: Record<string, number>;
}

export const Legend = ({ series }: { series: Series[] }) =>
  series.length < 2 ? null : (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );

/**
 * Vertical stacked bars, one per row (month), with the total above the
 * highest one and every value on hover.
 */
export const StackedBars = ({
  rows,
  series,
  format = String,
  height = 160,
}: {
  rows: StackedRow[];
  series: Series[];
  format?: (value: number) => string;
  height?: number;
}) => {
  const totals = rows.map((row) =>
    series.reduce((sum, item) => sum + (row.values[item.key] ?? 0), 0),
  );
  const max = Math.max(...totals, 0);
  const peak = totals.indexOf(max);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 sm:gap-2" style={{ height }}>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            tabIndex={0}
            aria-label={`${row.label}: ${format(totals[index])}`}
          >
            {index === peak && max > 0 ? (
              <span className="mb-1 truncate text-center text-xs font-medium text-muted-foreground">
                {format(max)}
              </span>
            ) : null}
            <div className="flex flex-col-reverse gap-[2px]">
              {series.map((item) => {
                const value = row.values[item.key] ?? 0;
                if (value <= 0 || max <= 0) return null;
                return (
                  <div
                    key={item.key}
                    className="w-full first:rounded-b-none last:rounded-t-[4px]"
                    style={{
                      height: Math.max(2, (value / max) * (height - 24)),
                      background: item.color,
                    }}
                  />
                );
              })}
            </div>
            <BarTooltip>
              <p className="font-medium">{row.label}</p>
              {series.map((item) => (
                <p key={item.key} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: item.color }}
                    aria-hidden
                  />
                  {item.label}: {format(row.values[item.key] ?? 0)}
                </p>
              ))}
            </BarTooltip>
          </div>
        ))}
      </div>
      <div className="flex gap-1 border-t pt-1 sm:gap-2">
        {rows.map((row) => (
          <span
            key={row.label}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
          >
            {row.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const BarTooltip = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden min-w-36 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
    {children}
  </div>
);

/** Horizontal bars for a ranked list: one series, labels on the left. */
export const RankedBars = ({
  rows,
  format = String,
  color = "var(--series-1)",
}: {
  rows: {
    key: string | number;
    label: ReactNode;
    value: number;
    note?: string;
  }[];
  format?: (value: number) => string;
  color?: string;
}) => {
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {format(row.value)}
              {row.note ? ` · ${row.note}` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? Math.max(2, (row.value / max) * 100) : 0}%`,
                background: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

/** A share of a whole, as a meter with its percent: load of a specialist. */
export const Meter = ({
  label,
  share,
  note,
}: {
  label: string;
  share: number;
  note: string;
}) => {
  const percent = Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {percent}% · {note}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-[var(--series-1)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Bookings by weekday and hour: darker green, busier hour. Only the hours
 * that had bookings are shown.
 */
export const Heatmap = ({
  cells,
  weekdayLabel,
}: {
  cells: { weekday: number; hour: number; bookings: number }[];
  weekdayLabel: (weekday: number) => string;
}) => {
  const translate = useTranslate();
  const hours = [...new Set(cells.map((cell) => cell.hour))].sort(
    (a, b) => a - b,
  );
  const max = Math.max(...cells.map((cell) => cell.bookings), 0);
  if (hours.length === 0) return null;
  const from = Math.min(...hours);
  const to = Math.max(...hours);
  const span = Array.from(
    { length: to - from + 1 },
    (_, index) => from + index,
  );
  const step = (value: number) =>
    value <= 0 ? 0 : Math.min(5, Math.ceil((value / max) * 5));

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th />
              {span.map((hour) => (
                <th
                  key={hour}
                  scope="col"
                  className="min-w-7 font-normal text-muted-foreground"
                >
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
              <tr key={weekday}>
                <th
                  scope="row"
                  className="pr-2 text-left font-normal text-muted-foreground capitalize"
                >
                  {weekdayLabel(weekday)}
                </th>
                {span.map((hour) => {
                  const value =
                    cells.find(
                      (cell) => cell.weekday === weekday && cell.hour === hour,
                    )?.bookings ?? 0;
                  const level = step(value);
                  return (
                    <td
                      key={hour}
                      title={`${weekdayLabel(weekday)} ${hour}:00 — ${value}`}
                      className={cn(
                        "h-7 min-w-7 rounded-[4px] text-center tabular-nums",
                        level === 0 && "bg-muted",
                        level >= 4 ? "text-white" : "text-foreground/80",
                      )}
                      style={
                        level > 0
                          ? { background: `var(--seq-${level})` }
                          : undefined
                      }
                    >
                      {value > 0 ? value : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate("crm.analytics.heatmap_hint")}
      </p>
    </div>
  );
};

/** A chart with a switch to its table: the same numbers, readable without color. */
export const ChartOrTable = ({
  chart,
  table,
}: {
  chart: ReactNode;
  table: ReactNode;
}) => {
  const translate = useTranslate();
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {asTable ? table : chart}
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline"
        onClick={() => setAsTable(!asTable)}
      >
        {translate(
          asTable ? "crm.analytics.show_chart" : "crm.analytics.show_table",
        )}
      </button>
    </div>
  );
};

/** The numbers of stacked rows as a table. */
export const RowsTable = ({
  rows,
  series,
  format = String,
  firstColumn,
}: {
  rows: StackedRow[];
  series: Series[];
  format?: (value: number) => string;
  firstColumn: string;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 pr-3 font-normal">{firstColumn}</th>
          {series.map((item) => (
            <th key={item.key} className="py-1 pr-3 text-right font-normal">
              {item.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b last:border-0">
            <td className="py-1 pr-3">{row.label}</td>
            {series.map((item) => (
              <td key={item.key} className="py-1 pr-3 text-right tabular-nums">
                {format(row.values[item.key] ?? 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
