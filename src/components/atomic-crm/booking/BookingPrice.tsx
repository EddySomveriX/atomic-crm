import {
  useCreate,
  useDataProvider,
  useGetList,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { formatMoney } from "../money/money";
import type { CertificateUse, GiftCertificate } from "../pricing/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Booking } from "./types";

/**
 * What a booking costs: the list price, the offer that lowered it, a
 * package that paid for it, certificates used on it, and what is left to
 * pay. A certificate is applied by its code; its use is a record that is
 * never changed.
 */
export const BookingPrice = ({
  booking,
  readOnly,
}: {
  booking: Booking;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const { currency, locale } = useConfigurationContext();
  const [code, setCode] = useState("");
  const [create, { isPending }] = useCreate<CertificateUse>();
  const { data: uses = [], refetch } = useGetList<CertificateUse>(
    "certificate_uses",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
      filter: { booking_id: booking.id },
    },
  );
  if (booking.price == null) return null;
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const covered = uses.reduce((sum, use) => sum + use.amount, 0);
  const left = Math.max(0, booking.price - covered);

  const apply = async () => {
    const { data } = await dataProvider.getList<GiftCertificate>(
      "gift_certificates",
      {
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
        filter: { code: code.trim().toUpperCase(), status: "active" },
      },
    );
    const certificate = data[0];
    if (!certificate || Date.parse(certificate.expires_at) < Date.now()) {
      notify("crm.pricing.certificate_not_found", { type: "warning" });
      return;
    }
    if (left === 0) {
      notify("crm.pricing.certificate_nothing_to_pay", { type: "info" });
      return;
    }
    const amount =
      certificate.amount != null
        ? Math.min(certificate.balance ?? 0, left)
        : left;
    create(
      "certificate_uses",
      {
        data: {
          certificate_id: certificate.id,
          booking_id: booking.id,
          amount,
        },
      },
      {
        onSuccess: () => {
          setCode("");
          refetch();
          notify("crm.pricing.certificate_applied", {
            type: "success",
            messageArgs: { code: certificate.code, amount: money(amount) },
          });
        },
        onError: () =>
          notify("crm.pricing.certificate_not_found", { type: "warning" }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">
          {translate("crm.pricing.price_line")}
        </span>
        <span className="tabular-nums">
          {booking.list_price != null &&
          booking.list_price !== booking.price ? (
            <span className="mr-2 text-muted-foreground line-through">
              {money(booking.list_price)}
            </span>
          ) : null}
          <b className="font-semibold">{money(booking.price)}</b>
        </span>
      </div>
      {booking.client_package_id ? (
        <p className="text-primary">
          {translate("crm.pricing.paid_by_package")}
        </p>
      ) : null}
      {booking.promo_code ? (
        <p className="text-muted-foreground">
          {translate("crm.pricing.promo_code_field")}: {booking.promo_code}
        </p>
      ) : null}
      {uses.length > 0 ? (
        <ul className="text-muted-foreground">
          {uses.map((use) => (
            <li key={String(use.id)}>
              {translate("crm.pricing.certificate_field")}: −{money(use.amount)}
            </li>
          ))}
        </ul>
      ) : null}
      {covered > 0 ? (
        <div className="flex justify-between font-medium">
          <span>{translate("crm.pricing.to_pay")}</span>
          <span className="tabular-nums">{money(left)}</span>
        </div>
      ) : null}
      {!readOnly && left > 0 && booking.status !== "cancelled" ? (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder={translate("crm.pricing.certificate_field")}
            aria-label={translate("crm.pricing.certificate_field")}
            maxLength={8}
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={apply}
            disabled={code.trim().length !== 8 || isPending}
          >
            {translate("crm.pricing.certificate_apply")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
