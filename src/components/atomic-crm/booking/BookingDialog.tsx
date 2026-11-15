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
  status: BookingStatus;
  note: string | null;
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
        status: booking.status,
        note: booking.note,
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
      status: values.status ?? "booked",
      note: values.note || null,
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
            {booking ? (
              <SelectInput
                source="status"
                choices={BOOKING_STATUSES.map((status) => ({
                  id: status,
                  name: translate(`crm.booking.statuses.${status}`),
                }))}
                validate={required()}
                helperText={false}
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
