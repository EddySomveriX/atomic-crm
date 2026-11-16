import { useMutation } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import {
  Form,
  required,
  useCreate,
  useDataProvider,
  useNotify,
  useTranslate,
  useUpdate,
  type Identifier,
} from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { NumberInput } from "@/components/admin/number-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CrmDataProvider } from "../providers/types";
import { ClientReliabilityBadge } from "../reliability/ReliabilityBadge";
import { DocumentsPanel } from "../documents/DocumentsPanel";
import { BookingPrice } from "./BookingPrice";
import { dayIn, timeIn, zonedDateTime } from "./bookingTime";
import {
  BOOKING_STATUSES,
  bookingErrorKey,
  specialistName,
  type Booking,
  type BookingStatus,
} from "./types";
import { useBookableServices, useSpecialists } from "./useBookingData";

export interface BookingDraft {
  sales_id?: Identifier;
  day: string;
  time?: string;
}

interface BookingFormValues {
  product_id: Identifier;
  sales_id: Identifier;
  client_id: Identifier | null;
  day: string;
  time: string;
  /** The statuses, plus "cancelled_by_client" for a call to cancel */
  status: BookingStatus | "cancelled_by_client";
  note: string | null;
  late_minutes: number | null;
  promo_code?: string | null;
}

/**
 * Creates a booking at a chosen time or changes one: service, specialist,
 * client, day and time in the business time zone, status and note.
 */
export const BookingDialog = ({
  booking,
  draft,
  timeZone,
  readOnly = false,
  onClose,
}: {
  booking?: Booking;
  draft?: BookingDraft;
  timeZone: string;
  readOnly?: boolean;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { services } = useBookableServices();
  const { specialists } = useSpecialists();
  const [create, { isPending: creating }] = useCreate<Booking>();
  const [update, { isPending: updating }] = useUpdate();

  const defaults: Partial<BookingFormValues> = booking
    ? {
        product_id: booking.product_id,
        sales_id: booking.sales_id,
        client_id: booking.client_id,
        day: dayIn(new Date(booking.starts_at), timeZone),
        time: timeIn(new Date(booking.starts_at), timeZone),
        status:
          booking.status === "cancelled" && booking.cancelled_by === "client"
            ? "cancelled_by_client"
            : booking.status,
        note: booking.note,
        late_minutes: booking.late_minutes ?? null,
      }
    : {
        sales_id: draft?.sales_id,
        product_id: services.length === 1 ? services[0].id : undefined,
        client_id: null,
        day: draft?.day,
        time: draft?.time,
        status: "booked",
        note: null,
      };

  const save = async (values: Partial<BookingFormValues>) => {
    const startsAt = zonedDateTime(values.day!, values.time!, timeZone);
    const data = {
      product_id: values.product_id,
      sales_id: values.sales_id,
      client_id: values.client_id ?? null,
      starts_at: startsAt.toISOString(),
      ...(values.status === "cancelled_by_client"
        ? { status: "cancelled" as const, cancelled_by: "client" as const }
        : { status: (values.status ?? "booked") as BookingStatus }),
      note: values.note || null,
      ...(booking
        ? { late_minutes: values.late_minutes || null }
        : { promo_code: values.promo_code?.trim().toUpperCase() || null }),
    };
    const options = {
      onSuccess: () => {
        notify("crm.booking.saved", { type: "success" });
        onClose();
      },
      onError: (error: unknown) =>
        notify(bookingErrorKey(error), { type: "error" }),
    };
    if (booking) {
      // A changed service or time gets a new end from the database
      const moved =
        data.starts_at !== new Date(booking.starts_at).toISOString() ||
        data.product_id !== booking.product_id;
      await update(
        "bookings",
        {
          id: booking.id,
          data: moved ? { ...data, ends_at: null } : data,
          previousData: booking,
        },
        { ...options, mutationMode: "pessimistic" },
      );
    } else {
      await create("bookings", { data }, options);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {translate(booking ? "crm.booking.edit" : "crm.booking.new")}
          </DialogTitle>
        </DialogHeader>
        <Form
          defaultValues={defaults}
          onSubmit={save}
          resource="bookings"
          disabled={readOnly}
        >
          <div className="flex flex-col gap-4">
            <SelectInput
              source="product_id"
              choices={services.map((service) => ({
                id: service.id,
                name: `${service.name} · ${translate("crm.booking.minutes", {
                  count: service.duration_minutes,
                })}`,
              }))}
              validate={required()}
              helperText={false}
            />
            <SelectInput
              source="sales_id"
              choices={specialists.map((specialist) => ({
                id: specialist.id,
                name: specialistName(specialist),
              }))}
              validate={required()}
              helperText={false}
            />
            <ReferenceInput source="client_id" reference="companies">
              <AutocompleteInput
                label={translate("resources.bookings.fields.client_id")}
                helperText={false}
              />
            </ReferenceInput>
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                source="day"
                type="date"
                validate={required()}
                helperText={false}
              />
              <TextInput
                source="time"
                type="time"
                step={300}
                validate={required()}
                helperText={false}
              />
            </div>
            {booking?.client_id != null ? (
              <ClientReliabilityBadge clientId={booking.client_id} />
            ) : null}
            {booking ? (
              <BookingFacts booking={booking} timeZone={timeZone} />
            ) : null}
            {booking ? (
              <DocumentsPanel links={{ booking_id: booking.id }} />
            ) : null}
            {booking ? (
              <BookingPrice booking={booking} readOnly={readOnly} />
            ) : (
              <TextInput
                source="promo_code"
                label={translate("crm.pricing.promo_code_field")}
                helperText={false}
              />
            )}
            {booking ? (
              <SelectInput
                source="status"
                choices={[
                  ...BOOKING_STATUSES.map((status) => ({
                    id: status,
                    name: translate(`crm.booking.statuses.${status}`),
                  })),
                  {
                    id: "cancelled_by_client",
                    name: translate("crm.booking.statuses.cancelled_by_client"),
                  },
                ]}
                validate={required()}
                helperText={false}
              />
            ) : null}
            {booking ? (
              <NumberInput
                source="late_minutes"
                min={0}
                max={600}
                step={5}
                helperText={translate("crm.reliability.late_hint")}
              />
            ) : null}
            <TextInput source="note" multiline helperText={false} />
          </div>
          <DialogFooter className="mt-6 flex-wrap gap-2">
            {booking && booking.status === "booked" && !readOnly ? (
              <RemindButton booking={booking} />
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate("ra.action.cancel")}
            </Button>
            {readOnly ? null : (
              <Button type="submit" disabled={creating || updating}>
                {translate("ra.action.save")}
              </Button>
            )}
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/** Sends the client a reminder of this booking in Telegram now. */
const RemindButton = ({ booking }: { booking: Booking }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const remind = useMutation({
    mutationFn: () => dataProvider.sendBookingReminder(booking.id),
    onSuccess: (result) =>
      notify(`crm.booking.reminder_${result}`, {
        type: result === "sent" ? "success" : "warning",
      }),
    onError: () => notify("crm.booking.reminder_failed", { type: "error" }),
  });
  return (
    <Button
      type="button"
      variant="outline"
      className="sm:mr-auto"
      onClick={() => remind.mutate()}
      disabled={remind.isPending}
    >
      <BellRing />
      {translate("crm.booking.remind_now")}
    </Button>
  );
};

/** What happened to a booking: confirmed by the client, cancelled, moved. */
const BookingFacts = ({
  booking,
  timeZone,
}: {
  booking: Booking;
  timeZone: string;
}) => {
  const translate = useTranslate();
  const facts = [
    booking.confirmed_at
      ? translate("crm.reliability.facts.confirmed", {
          when: `${dayIn(new Date(booking.confirmed_at), timeZone)} ${timeIn(new Date(booking.confirmed_at), timeZone)}`,
        })
      : null,
    booking.status === "cancelled" && booking.cancelled_by
      ? translate(
          booking.late_cancel
            ? "crm.reliability.facts.late_cancel"
            : `crm.reliability.facts.cancelled_by_${booking.cancelled_by}`,
        )
      : null,
    booking.reschedule_count
      ? translate("crm.reliability.facts.moved", {
          smart_count: booking.reschedule_count,
        })
      : null,
  ].filter(Boolean);
  if (facts.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
      {facts.map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
};
