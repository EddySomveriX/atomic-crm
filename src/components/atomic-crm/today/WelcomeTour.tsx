import {
  CalendarDays,
  Ellipsis,
  MessageCircle,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useStore, useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const TOUR_STORE_KEY = "tour.done";

const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: "today", icon: CalendarDays },
  { key: "create", icon: Plus },
  { key: "chats", icon: MessageCircle },
  { key: "more", icon: Ellipsis },
];

/**
 * Four short hints on the first visit: where the day is, what "+" does,
 * where the messages of clients are and where everything else lives. Shown
 * once on this device; "Skip" ends it at once.
 */
export const WelcomeTour = () => {
  const translate = useTranslate();
  const [isDone, setIsDone] = useStore<boolean>(TOUR_STORE_KEY, false);
  const [step, setStep] = useState(0);
  if (isDone) return null;

  const { key, icon: Icon } = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const finish = () => setIsDone(true);

  return (
    <section
      aria-label={translate("crm.tour.label")}
      className="flex gap-4 rounded-xl border border-primary/30 bg-accent px-4 py-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold">
            {translate(`crm.tour.steps.${key}.title`)}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={finish}
            aria-label={translate("crm.tour.skip")}
          >
            <X />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {translate(`crm.tour.steps.${key}.text`)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {translate("crm.tour.progress", {
              step: step + 1,
              total: STEPS.length,
            })}
          </span>
          <div className="flex gap-2">
            {!isLast ? (
              <Button variant="ghost" size="sm" onClick={finish}>
                {translate("crm.tour.skip")}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => (isLast ? finish() : setStep(step + 1))}
            >
              {translate(isLast ? "crm.tour.done" : "crm.tour.next")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
