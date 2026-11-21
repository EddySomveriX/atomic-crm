import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Camera, MapPin, Phone, Send } from "lucide-react";
import { useLocaleState, useTranslate } from "ra-core";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";

import { formatMoney } from "../money/money";
import {
  callBookingPage,
  type PageInfo,
  type PageOffer,
  type PageService,
} from "./bookingApi";
import { BookingFlow } from "./BookingFlow";
import { MyBookings } from "./MyBookings";

type View =
  { kind: "home" } | { kind: "book"; service: PageService } | { kind: "mine" };

const weekdayName = (weekday: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, weekday)),
  );

/** Services by category, in the order of the price list. */
const byCategory = (services: PageService[]) => {
  const groups = new Map<string, PageService[]>();
  for (const service of services) {
    const key = service.category ?? "";
    groups.set(key, [...(groups.get(key) ?? []), service]);
  }
  return [...groups.entries()];
};

/**
 * The public booking page of a business (/book/<slug>): who they are, where,
 * their prices, specialists and offers, and booking in a few taps. Works
 * without signing in; the client proves their phone with an SMS code.
 */
export const BookingPage = () => {
  const translate = useTranslate();
  const { slug = "" } = useParams();
  const [, setLocale] = useLocaleState();
  const [view, setView] = useState<View>({ kind: "home" });
  const {
    data: info,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["booking_page", slug],
    queryFn: () => callBookingPage<PageInfo>(slug, "page"),
    retry: false,
  });

  useEffect(() => {
    if (info?.language) setLocale(info.language);
  }, [info?.language, setLocale]);

  useEffect(() => {
    if (info?.business) document.title = info.business;
  }, [info?.business]);

  if (isPending) {
    return <div className="min-h-dvh bg-background" />;
  }
  if (isError || !info) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-center text-muted-foreground">
        {translate("crm.booking_page.not_found")}
      </main>
    );
  }

  const money = (minor: number) =>
    formatMoney(minor, info.currency, info.language);
  const offerLine = (offer: PageOffer) => {
    if (offer.kind === "happy_hours" && offer.time_from && offer.time_to) {
      return `${offer.weekdays.map((day) => weekdayName(day, info.language)).join(", ")} ${offer.time_from.slice(0, 5)}–${offer.time_to.slice(0, 5)}`;
    }
    if (offer.kind === "last_minute") {
      return translate("crm.marketing.templates.last_minute", {
        hours: offer.within_hours ?? 24,
      });
    }
    return translate("crm.marketing.templates.first_visit");
  };

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {info.business}
          </h1>
          {info.about ? (
            <p className="whitespace-pre-line text-muted-foreground">
              {info.about}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1.5 text-sm">
            {info.address ? (
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <MapPin className="size-4 text-muted-foreground" />
                  {info.address}
                </a>
              </li>
            ) : null}
            {info.phone ? (
              <li>
                <a
                  href={`tel:${info.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Phone className="size-4 text-muted-foreground" />
                  {info.phone}
                </a>
              </li>
            ) : null}
            <li className="flex flex-wrap gap-x-4 gap-y-1.5">
              {info.instagram ? (
                <a
                  href={`https://www.instagram.com/${info.instagram}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Camera className="size-4 text-muted-foreground" />@
                  {info.instagram}
                </a>
              ) : null}
              {info.telegram_bot ? (
                <a
                  href={`https://t.me/${info.telegram_bot}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Send className="size-4 text-muted-foreground" />
                  Telegram
                </a>
              ) : null}
            </li>
          </ul>
        </header>

        {view.kind === "book" ? (
          <BookingFlow
            slug={slug}
            info={info}
            service={view.service}
            onBack={() => setView({ kind: "home" })}
          />
        ) : view.kind === "mine" ? (
          <MyBookings
            slug={slug}
            info={info}
            onBack={() => setView({ kind: "home" })}
          />
        ) : (
          <>
            {info.offers.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">
                  {translate("crm.booking_page.offers")}
                </h2>
                <ul className="flex flex-col gap-2">
                  {info.offers.map((offer) => (
                    <li
                      key={offer.id}
                      className="flex items-center gap-4 rounded-lg border border-primary/40 px-4 py-3"
                    >
                      <span className="text-lg font-semibold tabular-nums text-primary">
                        −{offer.percent}%
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{offer.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {offerLine(offer)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {translate("crm.booking_page.services")}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView({ kind: "mine" })}
                >
                  <CalendarCheck />
                  {translate("crm.booking_page.mine")}
                </Button>
              </div>
              {info.services.length === 0 ? (
                <p className="text-muted-foreground">
                  {translate("crm.booking_page.no_services")}
                </p>
              ) : (
                byCategory(info.services).map(([category, services]) => (
                  <div key={category} className="flex flex-col gap-2">
                    {category ? (
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {category}
                      </h3>
                    ) : null}
                    <ul className="flex flex-col divide-y rounded-lg border">
                      {services.map((service) => (
                        <li
                          key={service.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {service.name}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {[
                                translate("crm.booking_page.minutes", {
                                  count: service.duration_minutes,
                                }),
                                service.price != null
                                  ? money(service.price)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {service.description ? (
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {service.description}
                              </span>
                            ) : null}
                          </span>
                          <Button
                            onClick={() => setView({ kind: "book", service })}
                          >
                            {translate("crm.booking_page.book_short")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>

            {info.specialists.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">
                  {translate("crm.booking_page.specialists")}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {info.specialists.map((person) => (
                    <li
                      key={person.id}
                      className="rounded-full border px-3 py-1 text-sm"
                    >
                      {person.name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
};

BookingPage.path = "/book/:slug";
