import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslate } from "ra-core";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { timeIn } from "../booking/bookingTime";
import {
  callBookingPage,
  saveToken,
  savedToken,
  type PageBooking,
  type PageInfo,
  dayLabel,
} from "./bookingApi";
import { PhoneCheck } from "./PhoneCheck";

/** The client's bookings ahead, found by their proven phone; each can be cancelled. */
export const MyBookings = ({
  slug,
  info,
  onBack,
}: {
  slug: string;
  info: PageInfo;
  onBack: () => void;
}) => {
  const translate = useTranslate();
  const [token, setToken] = useState<string | null>(() => savedToken(slug));
  const [bookings, setBookings] = useState<PageBooking[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(
    async (key: string) => {
      setBookings(null);
      try {
        const answer = await callBookingPage<{ bookings: PageBooking[] }>(
          slug,
          "my",
          { token: key },
        );
        setBookings(answer.bookings);
      } catch (error) {
        if (error instanceof Error && error.message === "verify_phone") {
          saveToken(slug, null);
          setToken(null);
        } else {
          setProblem("crm.booking_page.failed");
        }
      }
    },
    [slug],
  );

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const cancel = async (booking: PageBooking) => {
    if (!token || !window.confirm(translate("crm.booking_page.cancel_ask"))) {
      return;
    }
    try {
      await callBookingPage(slug, "cancel", { token, booking_id: booking.id });
      await load(token);
    } catch {
      setProblem("crm.booking_page.failed");
    }
  };

  const when = (startsAt: string) => {
    const date = new Date(startsAt);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: info.timezone,
    }).format(date);
    return `${dayLabel(day, info.language)}, ${timeIn(date, info.timezone)}`;
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label={translate("ra.action.back")}
        >
          <ArrowLeft />
        </Button>
        <h2 className="font-semibold">{translate("crm.booking_page.mine")}</h2>
      </div>
      {!token ? (
        <PhoneCheck slug={slug} onVerified={(key) => setToken(key)} />
      ) : bookings == null ? (
        <Loader2 className="animate-spin text-muted-foreground" />
      ) : bookings.length === 0 ? (
        <p className="text-muted-foreground">
          {translate("crm.booking_page.no_bookings")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{booking.serviceName}</span>
                <span className="block text-sm text-muted-foreground">
                  {when(booking.startsAt)} · {booking.specialistName}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancel(booking)}
              >
                {translate("crm.booking_page.cancel")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {problem ? (
        <p className="text-sm text-destructive">{translate(problem)}</p>
      ) : null}
      {token ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.booking_page.move_hint")}
        </p>
      ) : null}
    </section>
  );
};
