import { useGetList, useNotify, useTranslate, useUpdate } from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";

import type { Product } from "../products/types";

/**
 * After how many days each service is worth repeating; an empty field means
 * the service gets no "time to repeat" message.
 */
export const RebookDays = ({ disabled }: { disabled: boolean }) => {
  const translate = useTranslate();
  const { data: services = [] } = useGetList<Product>("products", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
    filter: { kind: "service", archived: false, "is_addon@is": false },
  });

  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("crm.automations.rebook_no_services")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span>{translate("crm.automations.rebook_hint")}</span>
      <ul className="flex flex-col divide-y rounded-md border">
        {services.map((service) => (
          <ServiceDays key={service.id} service={service} disabled={disabled} />
        ))}
      </ul>
    </div>
  );
};

const ServiceDays = ({
  service,
  disabled,
}: {
  service: Product;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [update] = useUpdate();
  const saved = service.rebook_days ?? null;
  const [days, setDays] = useState(saved == null ? "" : String(saved));

  const save = () => {
    const value = days.trim() === "" ? null : Number(days);
    if (
      value != null &&
      (!Number.isInteger(value) || value < 1 || value > 365)
    ) {
      notify("crm.automations.days_invalid", { type: "warning" });
      setDays(saved == null ? "" : String(saved));
      return;
    }
    if (value === saved) return;
    update(
      "products",
      { id: service.id, data: { rebook_days: value }, previousData: service },
      {
        onError: () => notify("crm.automations.save_failed", { type: "error" }),
      },
    );
  };

  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <span className="min-w-0 flex-1 truncate">{service.name}</span>
      <span className="text-muted-foreground">
        {translate("crm.automations.after")}
      </span>
      <Input
        value={days}
        onChange={(event) => setDays(event.target.value)}
        onBlur={save}
        inputMode="numeric"
        placeholder="—"
        className="h-8 w-16 text-right"
        disabled={disabled}
        aria-label={`${service.name}: ${translate("crm.automations.days")}`}
      />
      <span className="text-muted-foreground">
        {translate("crm.automations.days")}
      </span>
    </li>
  );
};
