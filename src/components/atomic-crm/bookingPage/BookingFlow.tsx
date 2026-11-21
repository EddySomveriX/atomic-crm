import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslate } from "ra-core";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { timeIn } from "../booking/bookingTime";
import { formatMoney } from "../money/money";
import {
  callBookingPage,
  saveToken,
  savedToken,
  type PageInfo,
  type PageService,
  type PageSlot,
  dayLabel,
} from "./bookingApi";
import { PhoneCheck } from "./PhoneCheck";

const ANY = 0;

type Step = "specialist" | "day" | "time" | "phone" | "details" | "done";

const optionClass = (isOn: boolean) =>
  cn(
    "rounded-lg border px-4 py-3 text-left transition-colors",
    isOn ? "border-primary bg-primary/5" : "hover:border-foreground/30",
  );

/** Booking a chosen service: specialist, day, time, phone, name. */
export const BookingFlow = ({
  slug,
  info,
  service,
  onBack,
}: {
  slug: string;
  info: PageInfo;
  service: PageService;
  onBack: () => void;
}) => {
  const translate = useTranslate();
  const locale = info.language;
  const [step, setStep] = useState<Step>("specialist");
  const [salesId, setSalesId] = useState<number>(ANY);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<PageSlot[] | null>(null);
  const [slot, setSlot] = useState<PageSlot | null>(null);
  const [token, setToken] = useState<string | null>(() => savedToken(slug));
  const [name, setName] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const specialistOf = (id: number) =>
    info.specialists.find((item) => item.id === id)?.name ?? "";

  useEffect(() => {
    if (step !== "day") return;
    setDays(null);
    callBookingPage<{ days: string[] }>(slug, "days", {
      service_id: service.id,
      sales_id: salesId || null,
    })
      .then((answer) => setDays(answer.days))
      .catch(() => setProblem("crm.booking_page.failed"));
  }, [slug, service.id, salesId, step]);

  useEffect(() => {
    if (step !== "time" || !day) return;
    setSlots(null);
    callBookingPage<{ slots: PageSlot[] }>(slug, "slots", {
      service_id: service.id,
      sales_id: salesId || null,
      day,
    })
      .then((answer) => setSlots(answer.slots))
      .catch(() => setProblem("crm.booking_page.failed"));
  }, [slug, service.id, salesId, day, step]);

  const book = async (event: FormEvent) => {
    event.preventDefault();
    if (!slot || !token) return;
    setIsBusy(true);
    setProblem(null);
    try {
      const answer = await callBookingPage<{ status: string }>(slug, "book", {
        token,
        service_id: service.id,
        slot,
        name: name.trim(),
        consent: hasConsent,
      });
      if (answer.status === "booked") {
        setStep("done");
      } else {
        setProblem("crm.booking_page.taken");
        setSlot(null);
        setStep("time");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "verify_phone") {
        saveToken(slug, null);
        setToken(null);
        setStep("phone");
      } else {
        setProblem("crm.booking_page.failed");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const back = () => {
    setProblem(null);
    const previous: Partial<Record<Step, Step>> = {
      day: "specialist",
      time: "day",
      phone: "time",
      details: "time",
    };
    const target = previous[step];
    if (target) setStep(target);
    else onBack();
  };

  const summary = [
    service.name,
    slot
      ? `${day ? dayLabel(day, locale) : ""}, ${timeIn(new Date(slot.starts_at), info.timezone)}`
      : null,
    slot ? specialistOf(slot.sales_id) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (step === "done") {
    return (
      <section className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h2 className="text-xl font-semibold">
          {translate("crm.booking_page.booked")}
        </h2>
        <p className="text-muted-foreground">{summary}</p>
        <Button variant="outline" onClick={onBack}>
          {translate("crm.booking_page.to_start")}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={back}
          aria-label={translate("ra.action.back")}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{service.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[
              translate("crm.booking_page.minutes", {
                count: service.duration_minutes,
              }),
              service.price != null
                ? formatMoney(service.price, info.currency, locale)
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {step === "specialist" ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">
            {translate("crm.booking_page.choose_specialist")}
          </h3>
          {[
            { id: ANY, name: translate("crm.booking_page.any") },
            ...info.specialists,
          ].map((person) => (
            <button
              key={person.id}
              type="button"
              className={optionClass(salesId === person.id)}
              onClick={() => {
                setSalesId(person.id);
                setStep("day");
              }}
            >
              {person.name}
            </button>
          ))}
        </div>
      ) : null}

      {step === "day" ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">
            {translate("crm.booking_page.choose_day")}
          </h3>
          {days == null ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : days.length === 0 ? (
            <p className="text-muted-foreground">
              {translate("crm.booking_page.no_days")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {days.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={optionClass(day === item)}
                  onClick={() => {
                    setDay(item);
                    setStep("time");
                  }}
                >
                  {dayLabel(item, locale)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {step === "time" ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">{day ? dayLabel(day, locale) : ""}</h3>
          {problem ? (
            <p className="text-sm text-destructive">{translate(problem)}</p>
          ) : null}
          {slots == null ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((item) => (
                <button
                  key={`${item.sales_id}-${item.starts_at}`}
                  type="button"
                  className={cn(
                    optionClass(slot?.starts_at === item.starts_at),
                    "text-center tabular-nums",
                  )}
                  onClick={() => {
                    setSlot(item);
                    setProblem(null);
                    setStep(token ? "details" : "phone");
                  }}
                >
                  {timeIn(new Date(item.starts_at), info.timezone)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {step === "phone" ? (
        <>
          <p className="rounded-lg bg-muted px-4 py-3 text-sm">{summary}</p>
          <PhoneCheck
            slug={slug}
            onVerified={(newToken) => {
              setToken(newToken);
              setStep("details");
            }}
          />
        </>
      ) : null}

      {step === "details" ? (
        <form onSubmit={book} className="flex flex-col gap-3">
          <p className="rounded-lg bg-muted px-4 py-3 text-sm">{summary}</p>
          <Label htmlFor="booking-name">
            {translate("crm.booking_page.name")}
          </Label>
          <Input
            id="booking-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            className="h-12 text-lg"
          />
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={hasConsent}
              onCheckedChange={(checked) => setHasConsent(checked === true)}
              className="mt-0.5"
            />
            <span>{translate("crm.booking_page.consent")}</span>
          </label>
          {problem ? (
            <p className="text-sm text-destructive">{translate(problem)}</p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            disabled={!name.trim() || !hasConsent || isBusy}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : null}
            {translate("crm.booking_page.book")}
          </Button>
        </form>
      ) : null}
    </section>
  );
};
