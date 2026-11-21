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
  type Identifier,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useBookableServices } from "../booking/useBookingData";
import { formatMoney } from "../money/money";
import type { Product } from "../products/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { parsePrice } from "./priceList";
import type { ClientPackage, Package } from "./types";
import { Package as PackageIcon } from "lucide-react";
import { EmptyState } from "../misc/PageStates";

const DAY_MS = 86_400_000;

/**
 * Packages (the "Пакети" tab): several visits of a service paid at once,
 * e.g. five manicures for the price of four. A client holding one books
 * that service at no price, and each completed visit uses one. For now they
 * are sold in the salon and marked paid in cash or by card.
 */
export const PackagesTab = () => {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const canEdit = permissions !== "accountant";
  const { currency, locale } = useConfigurationContext();
  const [creating, setCreating] = useState(false);
  const [selling, setSelling] = useState<Package | null>(null);
  const { data: packages = [] } = useGetList<Package>("packages", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
    filter: { active: true },
  });
  const { data: sold = [] } = useGetList<ClientPackage>("client_packages", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "sold_at", order: "DESC" },
  });
  const productIds = [...new Set(packages.map((item) => item.product_id))];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );
  const clientIds = [...new Set(sold.map((item) => item.client_id))];
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );
  const productOf = (id: Identifier) => products.find((item) => item.id === id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {translate("crm.pricing.packages_hint")}
        </p>
        {canEdit ? (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {translate("crm.pricing.package_new")}
          </Button>
        ) : null}
      </div>

      {packages.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {packages.map((item) => {
            const product = productOf(item.product_id);
            const single = (product?.price ?? 0) * item.visits;
            return (
              <li
                key={String(item.id)}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {translate("crm.pricing.package_line", {
                      visits: item.visits,
                      service: product?.name ?? "",
                      days: item.valid_days,
                    })}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">
                    {formatMoney(item.price, currency, locale)}
                  </span>
                  {single > item.price ? (
                    <span className="block text-xs text-muted-foreground line-through">
                      {formatMoney(single, currency, locale)}
                    </span>
                  ) : null}
                </span>
                {canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelling(item)}
                  >
                    {translate("crm.pricing.sell")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={PackageIcon}
          title={translate("crm.pricing.no_packages_title")}
          text={translate("crm.pricing.no_packages")}
        />
      )}

      {sold.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {translate("crm.pricing.sold_packages")}
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
            {sold.map((item) => (
              <SoldPackageRow
                key={String(item.id)}
                item={item}
                clientName={
                  clients.find((client) => client.id === item.client_id)
                    ?.name ?? ""
                }
                serviceName={productOf(item.product_id)?.name ?? ""}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {creating ? <PackageDialog onClose={() => setCreating(false)} /> : null}
      {selling ? (
        <SellPackageDialog item={selling} onClose={() => setSelling(null)} />
      ) : null}
    </div>
  );
};

const SoldPackageRow = ({
  item,
  clientName,
  serviceName,
}: {
  item: ClientPackage;
  clientName: string;
  serviceName: string;
}) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const expired = Date.parse(item.expires_at) < Date.now();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
      <span className="min-w-0 flex-1 truncate font-medium">{clientName}</span>
      <span className="text-muted-foreground">{serviceName}</span>
      <span className="tabular-nums">
        {translate("crm.pricing.visits_left", {
          left: item.visits_left,
          total: item.visits_total,
        })}
      </span>
      <span className={expired ? "text-destructive" : "text-muted-foreground"}>
        {translate("crm.pricing.until", {
          date: new Date(item.expires_at).toLocaleDateString(uiLocale),
        })}
      </span>
    </li>
  );
};

const PackageDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { services } = useBookableServices();
  const [create, { isPending }] = useCreate<Package>();
  const [productId, setProductId] = useState<string>("");
  const [visits, setVisits] = useState("5");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("180");
  const [name, setName] = useState("");
  const service = services.find((item) => String(item.id) === productId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const minor = parsePrice(price);
    if (!service || minor == null) return;
    create(
      "packages",
      {
        data: {
          name: name.trim() || `${visits} × ${service.name}`,
          product_id: service.id,
          visits: Number(visits),
          price: minor,
          valid_days: Number(days),
        },
      },
      {
        onSuccess: onClose,
        onError: () => notify("crm.pricing.save_failed", { type: "error" }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{translate("crm.pricing.package_new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="package-service">
              {translate("resources.bookings.fields.product_id")}
            </Label>
            <select
              id="package-service"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="" disabled>
                —
              </option>
              {services.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="package-visits">
                {translate("crm.pricing.package_visits")}
              </Label>
              <Input
                id="package-visits"
                type="number"
                min={2}
                max={100}
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="package-price">
                {translate("crm.pricing.package_price")}
              </Label>
              <Input
                id="package-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="package-days">
                {translate("crm.pricing.package_days")}
              </Label>
              <Input
                id="package-days"
                type="number"
                min={7}
                max={1095}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
              />
            </div>
          </div>
          {service?.price != null && Number(visits) > 1 ? (
            <p className="text-sm text-muted-foreground">
              {translate("crm.pricing.package_compare", {
                total: (service.price * Number(visits)) / 100,
              })}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="package-name">
              {translate("crm.pricing.offer_name")}
            </Label>
            <Input
              id="package-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={service ? `${visits} × ${service.name}` : ""}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate("ra.action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {translate("ra.action.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const SellPackageDialog = ({
  item,
  onClose,
}: {
  item: Package;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [create, { isPending }] = useCreate<ClientPackage>();

  const sell = (values: {
    client_id?: Identifier;
    payment_method?: ClientPackage["payment_method"];
  }) =>
    create(
      "client_packages",
      {
        data: {
          package_id: item.id,
          client_id: values.client_id,
          product_id: item.product_id,
          visits_total: item.visits,
          visits_left: item.visits,
          expires_at: new Date(
            Date.now() + item.valid_days * DAY_MS,
          ).toISOString(),
          price_paid: item.price,
          payment_method: values.payment_method,
        },
      },
      {
        onSuccess: () => {
          notify("crm.pricing.package_sold", { type: "success" });
          onClose();
        },
        onError: () => notify("crm.pricing.save_failed", { type: "error" }),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("crm.pricing.sell_package", { name: item.name })}
          </DialogTitle>
        </DialogHeader>
        <Form defaultValues={{ payment_method: "cash" }} onSubmit={sell}>
          <div className="flex flex-col gap-4">
            <ReferenceInput source="client_id" reference="companies">
              <AutocompleteInput
                label={translate("resources.bookings.fields.client_id")}
                validate={required()}
                helperText={false}
              />
            </ReferenceInput>
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

/** Paid in cash or by card at the counter. */
export const PaymentMethodInput = () => {
  const translate = useTranslate();
  return (
    <SelectInput
      source="payment_method"
      label={translate("crm.pricing.payment_method")}
      choices={[
        { id: "cash", name: translate("crm.pricing.payment_methods.cash") },
        { id: "card", name: translate("crm.pricing.payment_methods.card") },
      ]}
      validate={required()}
      helperText={false}
    />
  );
};
