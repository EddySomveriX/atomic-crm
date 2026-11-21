import {
  Form,
  required,
  useCreate,
  useGetList,
  useGetMany,
  useLocaleState,
  useNotify,
  usePermissions,
  useTranslate,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { useState } from "react";
import { Download, Gift } from "lucide-react";
import { NumberInput } from "@/components/admin/number-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
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
import { cn } from "@/lib/utils";

import { MENU_COLORS, FONTS } from "../appearance/appearance";
import { useAppearance } from "../appearance/useAppearance";
import { useBookableServices } from "../booking/useBookingData";
import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { drawCertificate } from "./certificateImage";
import { PaymentMethodInput } from "./PackagesTab";
import type { GiftCertificate } from "./types";
import { EmptyState } from "../misc/PageStates";

const MONTH_MS = 30 * 86_400_000;

/**
 * Gift certificates (the "Сертифікати" tab): for an amount, spent on visits
 * until nothing is left, or for one service. Each one gets a code to tell
 * at the visit, and a picture to send. For now they are sold in the salon.
 */
export const CertificatesTab = () => {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const canSell = permissions !== "accountant";
  const [selling, setSelling] = useState(false);
  const [shown, setShown] = useState<GiftCertificate | null>(null);
  const { data: certificates = [] } = useGetList<GiftCertificate>(
    "gift_certificates",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sold_at", order: "DESC" },
    },
  );
  const productIds = [
    ...new Set(certificates.flatMap((item) => item.product_id ?? [])),
  ];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {translate("crm.pricing.certificates_hint")}
        </p>
        {canSell ? (
          <Button onClick={() => setSelling(true)}>
            <Gift />
            {translate("crm.pricing.certificate_sell")}
          </Button>
        ) : null}
      </div>
      {certificates.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={translate("crm.pricing.no_certificates_title")}
          text={translate("crm.pricing.no_certificates")}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {certificates.map((item) => (
            <CertificateRow
              key={String(item.id)}
              item={item}
              serviceName={
                products.find((product) => product.id === item.product_id)?.name
              }
              onShow={() => setShown(item)}
            />
          ))}
        </ul>
      )}
      {selling ? (
        <SellCertificateDialog
          onClose={() => setSelling(false)}
          onSold={(item) => {
            setSelling(false);
            setShown(item);
          }}
        />
      ) : null}
      {shown ? (
        <CertificatePicture
          item={shown}
          serviceName={
            products.find((product) => product.id === shown.product_id)?.name
          }
          onClose={() => setShown(null)}
        />
      ) : null}
    </div>
  );
};

const CertificateRow = ({
  item,
  serviceName,
  onShow,
}: {
  item: GiftCertificate;
  serviceName?: string;
  onShow: () => void;
}) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { currency, locale } = useConfigurationContext();
  const expired =
    item.status === "active" && Date.parse(item.expires_at) < Date.now();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <span className="w-28 font-mono text-sm font-semibold tracking-wider">
        {item.code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {item.amount != null
            ? translate("crm.pricing.certificate_balance", {
                balance: formatMoney(item.balance ?? 0, currency, locale),
                amount: formatMoney(item.amount, currency, locale),
              })
            : serviceName}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {[
            item.recipient_name,
            translate("crm.pricing.until", {
              date: new Date(item.expires_at).toLocaleDateString(uiLocale),
            }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          expired
            ? "bg-destructive/10 text-destructive"
            : item.status === "active"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {translate(
          `crm.pricing.certificate_status.${expired ? "expired" : item.status}`,
        )}
      </span>
      <Button variant="ghost" size="sm" onClick={onShow}>
        {translate("crm.pricing.certificate_picture")}
      </Button>
    </li>
  );
};

interface SellValues {
  kind: "amount" | "service";
  amount?: number;
  product_id?: number;
  months: number;
  recipient_name?: string;
  buyer_name?: string;
  payment_method: "cash" | "card";
}

const SellCertificateDialog = ({
  onClose,
  onSold,
}: {
  onClose: () => void;
  onSold: (item: GiftCertificate) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { services } = useBookableServices();
  const [create, { isPending }] = useCreate<GiftCertificate>();

  const sell = (values: Partial<SellValues>) => {
    const service = services.find((item) => item.id === values.product_id);
    const amount =
      values.kind === "amount" ? Math.round(Number(values.amount) * 100) : null;
    create(
      "gift_certificates",
      {
        data: {
          amount,
          product_id: values.kind === "service" ? values.product_id : null,
          expires_at: new Date(
            Date.now() + Number(values.months) * MONTH_MS,
          ).toISOString(),
          recipient_name: values.recipient_name || null,
          buyer_name: values.buyer_name || null,
          price_paid: amount ?? service?.price ?? 0,
          payment_method: values.payment_method,
        },
      },
      {
        onSuccess: (item) => {
          notify("crm.pricing.certificate_sold", { type: "success" });
          onSold(item);
        },
        onError: () => notify("crm.pricing.save_failed", { type: "error" }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{translate("crm.pricing.certificate_sell")}</DialogTitle>
        </DialogHeader>
        <Form
          defaultValues={{
            kind: "amount",
            amount: 1000,
            months: 6,
            payment_method: "cash",
          }}
          onSubmit={sell}
        >
          <div className="flex flex-col gap-4">
            <RadioButtonGroupInput
              source="kind"
              label={false}
              row
              choices={[
                {
                  id: "amount",
                  name: translate("crm.pricing.certificate_kinds.amount"),
                },
                {
                  id: "service",
                  name: translate("crm.pricing.certificate_kinds.service"),
                },
              ]}
              helperText={false}
            />
            <KindFields services={services} />
            <NumberInput
              source="months"
              label={translate("crm.pricing.certificate_months")}
              min={1}
              max={36}
              validate={required()}
              helperText={false}
            />
            <TextInput
              source="recipient_name"
              label={translate("crm.pricing.certificate_recipient")}
              helperText={false}
            />
            <TextInput
              source="buyer_name"
              label={translate("crm.pricing.certificate_buyer")}
              helperText={false}
            />
            <PaymentMethodInput />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate("ra.action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {translate("crm.pricing.sell")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const KindFields = ({ services }: { services: Product[] }) => {
  const translate = useTranslate();
  const kind = useWatch({ name: "kind" });
  return kind === "service" ? (
    <SelectInput
      source="product_id"
      label={translate("resources.bookings.fields.product_id")}
      choices={services.map((item) => ({ id: item.id, name: item.name }))}
      validate={required()}
      helperText={false}
    />
  ) : (
    <NumberInput
      source="amount"
      label={translate("crm.pricing.certificate_amount")}
      min={1}
      validate={required()}
      helperText={false}
    />
  );
};

/** The picture of a certificate to download and send. */
const CertificatePicture = ({
  item,
  serviceName,
  onClose,
}: {
  item: GiftCertificate;
  serviceName?: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { title, currency, locale } = useConfigurationContext();
  const appearance = useAppearance();
  const colors = MENU_COLORS[appearance.menuColor];
  const picture = drawCertificate({
    business: title,
    title: translate("crm.pricing.certificate_title"),
    value:
      item.amount != null
        ? formatMoney(item.amount, currency, locale)
        : (serviceName ?? ""),
    recipient: item.recipient_name
      ? translate("crm.pricing.certificate_for", { name: item.recipient_name })
      : null,
    code: translate("crm.pricing.certificate_code", { code: item.code }),
    until: translate("crm.pricing.until", {
      date: new Date(item.expires_at).toLocaleDateString(uiLocale),
    }),
    background: colors.background,
    mark: colors.mark,
    font: `"${FONTS[appearance.font]}", system-ui, sans-serif`,
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate("crm.pricing.certificate_picture")}
          </DialogTitle>
        </DialogHeader>
        {picture ? (
          <img
            src={picture}
            alt={translate("crm.pricing.certificate_title")}
            className="w-full rounded-lg"
          />
        ) : null}
        <p className="text-sm text-muted-foreground">
          {translate("crm.pricing.certificate_send_hint")}
        </p>
        <DialogFooter>
          <a
            href={picture}
            download={`certificate-${item.code}.png`}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Download className="size-4" />
            {translate("crm.pricing.certificate_download")}
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
