import { CalendarClock } from "lucide-react";
import {
  useDataProvider,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { addDays, dayIn } from "../booking/bookingTime";
import { useBusinessTimeZone } from "../booking/useBookingData";
import type { Product } from "../products/types";
import type { CrmDataProvider } from "../providers/types";
import type { PostDraft } from "./PostEditor";
import { freeSlotsPostText } from "./postTemplates";
import { useBookingLink } from "./useBookingLink";

/** Services listed in a post about free times */
const MAX_SERVICES = 8;

/**
 * Drafts a post with tomorrow's free times of the services clients book
 * online, so empty hours get filled.
 */
export const FreeSlotsButton = ({
  onDraft,
}: {
  onDraft: (draft: PostDraft) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const [locale = "uk"] = useLocaleState();
  const bookingLink = useBookingLink();
  const [isBusy, setIsBusy] = useState(false);
  const { data: services = [] } = useGetList<Product>("products", {
    pagination: { page: 1, perPage: MAX_SERVICES },
    sort: { field: "sort_order", order: "ASC" },
    filter: {
      kind: "service",
      archived: false,
      show_online: true,
      "duration_minutes@not.is": null,
    },
  });
  if (services.length === 0) return null;

  const draft = async () => {
    setIsBusy(true);
    try {
      const day = addDays(dayIn(new Date(), timeZone), 1);
      const slots = await dataProvider.getFreeSlots(
        services.map((service) => service.id),
        day,
        timeZone,
      );
      const text = freeSlotsPostText({
        dayLabel: new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        }).format(new Date(`${day}T00:00:00Z`)),
        slots: slots.map((item) => ({
          service:
            services.find((service) => service.id === item.product_id)?.name ??
            "",
          times: item.times,
        })),
        bookingLink,
        translate,
      });
      if (text == null) {
        notify("crm.marketing.no_free_slots", { type: "info" });
        return;
      }
      onDraft({ text, source: "free_slots" });
    } catch {
      notify("crm.marketing.failed", { type: "error" });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={draft} disabled={isBusy}>
      <CalendarClock />
      {translate("crm.marketing.free_slots")}
    </Button>
  );
};
