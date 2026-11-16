import { useNotify, useTranslate, useUpdate } from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";

import type { Company } from "../types";

/** The client's birthday on their card, for the birthday greeting. */
export const ClientBirthday = ({
  client,
  disabled = false,
}: {
  client: Company;
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [update] = useUpdate();
  const saved = client.birth_date ?? "";
  const [value, setValue] = useState(saved);

  const save = () => {
    if (value === saved) return;
    update(
      "companies",
      {
        id: client.id,
        data: { birth_date: value || null },
        previousData: client,
      },
      {
        onError: () => {
          setValue(saved);
          notify("crm.automations.save_failed", { type: "error" });
        },
      },
    );
  };

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold text-muted-foreground">
        {translate("crm.automations.birth_date")}
      </span>
      <Input
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        disabled={disabled}
        className="h-8 w-40"
      />
    </label>
  );
};
