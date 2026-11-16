import { useGetList, useGetOne, useLocaleState, useTranslate } from "ra-core";

import { formatMoney } from "../money/money";
import type { Promotion } from "../pricing/types";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { PostEditor } from "./PostEditor";
import { offerPostText } from "./postTemplates";
import type { MarketingAccount } from "./types";
import { useBookingLink } from "./useBookingLink";

/** The post editor opened with a ready text about an offer of the price list. */
export const OfferPostEditor = ({
  offerId,
  accounts,
  onClose,
}: {
  offerId: string;
  accounts: MarketingAccount[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const bookingLink = useBookingLink();
  const { data: promotion } = useGetOne<Promotion>("promotions", {
    id: offerId,
  });
  const { data: services, isPending } = useGetList<Product>("products", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "sort_order", order: "ASC" },
    filter: { kind: "service", archived: false },
  });
  if (!promotion || isPending) return null;

  const offered = (services ?? []).filter(
    (service) =>
      promotion.product_ids.length === 0 ||
      promotion.product_ids.map(String).includes(String(service.id)),
  );
  const text = offerPostText({
    promotion,
    services: offered.map((service) => ({
      name: service.name,
      price: service.price,
    })),
    money: (minor) => formatMoney(minor, currency, locale),
    formatDate: (day) =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`)),
    bookingLink,
    translate,
  });

  return (
    <PostEditor
      draft={{ text, source: "offer", promotionId: promotion.id }}
      accounts={accounts}
      onClose={onClose}
    />
  );
};
