import { useTranslate } from "ra-core";

import { LEVEL_POINTS, levelOf, levelProgress } from "./boardLogic";

/**
 * The level of the business: it grows with every client and every visit and
 * never goes back. Hidden in calm mode.
 */
export const LevelBar = ({ points }: { points: number }) => {
  const translate = useTranslate();
  const level = levelOf(points);
  const next = LEVEL_POINTS[level];
  const percent = Math.round(levelProgress(points) * 100);
  return (
    <section
      className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
      aria-label={translate("crm.business_map.level", { level })}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums">
          {translate("crm.business_map.level", { level })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {next === undefined
            ? translate("crm.business_map.top_level")
            : translate("crm.business_map.to_next", {
                count: next - points,
                level: level + 1,
              })}
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {translate("crm.business_map.level_hint")}
      </p>
    </section>
  );
};
