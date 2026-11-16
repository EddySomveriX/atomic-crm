import { useNotify, useTranslate, useUpdate } from "ra-core";
import { useState } from "react";
import { Input } from "@/components/ui/input";

import type { Company } from "../types";
import { instagramUsername } from "./types";

/** The client's Instagram on their card, with a link to the profile. */
export const ClientInstagram = ({
  client,
  disabled = false,
}: {
  client: Company;
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [update] = useUpdate();
  const saved = client.instagram ?? "";
  const [value, setValue] = useState(saved);

  const save = () => {
    const username = value.trim() === "" ? null : instagramUsername(value);
    if (value.trim() !== "" && username == null) {
      notify("crm.marketing.instagram_invalid", { type: "warning" });
      setValue(saved);
      return;
    }
    setValue(username ?? "");
    if ((username ?? "") === saved) return;
    update(
      "companies",
      {
        id: client.id,
        data: { instagram: username },
        previousData: client,
      },
      {
        onError: () => {
          setValue(saved);
          notify("crm.marketing.failed", { type: "error" });
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <label
        htmlFor={`instagram-${client.id}`}
        className="font-semibold text-muted-foreground"
      >
        Instagram
      </label>
      <span className="flex items-center gap-2">
        {saved ? (
          <a
            href={`https://www.instagram.com/${saved}/`}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {translate("crm.marketing.open_profile")}
          </a>
        ) : null}
        <Input
          id={`instagram-${client.id}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          disabled={disabled}
          placeholder="@username"
          className="h-8 w-40"
        />
      </span>
    </div>
  );
};
