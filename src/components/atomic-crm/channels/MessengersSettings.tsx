import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CrmDataProvider } from "../providers/types";
import { ChannelIcon } from "./ChannelIcon";
import { MESSENGER_KINDS, type Channel, type MessengerKind } from "./types";

/** What the server answers after a messenger is connected. */
export interface MessengerConnection {
  name: string;
  /** Where the messenger sends messages; null while the CRM is not online */
  webhook_url: string | null;
  /** Meta asks for it next to the address */
  verify_token: string | null;
}

type Field = "access_token" | "app_secret" | "phone_number_id";

/** What the owner brings from each messenger */
const FIELDS: Record<MessengerKind, Field[]> = {
  instagram: ["access_token", "app_secret"],
  messenger: ["access_token", "app_secret"],
  whatsapp: ["access_token", "phone_number_id", "app_secret"],
  viber: ["access_token"],
};
const STEPS = ["1", "2", "3"] as const;
const KNOWN_ERRORS = ["invalid_input", "token_refused", "webhook_failed"];

/**
 * Instagram Direct, Facebook Messenger, WhatsApp and Viber of the business,
 * for its owner. Tokens are typed here and go straight to the server, which
 * keeps them out of reach of the interface.
 */
export const MessengersSettings = ({
  channels,
  onChange,
}: {
  channels: Channel[];
  onChange: () => void;
}) => (
  <>
    {MESSENGER_KINDS.map((kind) => (
      <MessengerChannel
        key={kind}
        kind={kind}
        connected={channels.find(
          (channel) => channel.kind === kind && channel.enabled,
        )}
        onChange={onChange}
      />
    ))}
  </>
);

const MessengerChannel = ({
  kind,
  connected,
  onChange,
}: {
  kind: MessengerKind;
  connected: Channel | undefined;
  onChange: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [values, setValues] = useState<Partial<Record<Field, string>>>({});
  const [connection, setConnection] = useState<MessengerConnection | null>(
    null,
  );
  const fields = FIELDS[kind];
  const isFilled = fields.every((field) => values[field]?.trim());

  const connect = useMutation({
    mutationFn: () =>
      dataProvider.connectMessenger({
        kind,
        access_token: values.access_token?.trim() ?? "",
        app_secret: values.app_secret?.trim(),
        phone_number_id: values.phone_number_id?.trim(),
      }),
    onSuccess: (result) => {
      setValues({});
      setConnection(result);
      notify("crm.messengers.connected", {
        type: "success",
        messageArgs: { name: result.name },
      });
      onChange();
    },
    onError: (error: Error) =>
      notify(
        KNOWN_ERRORS.includes(error.message)
          ? `crm.messengers.errors.${error.message}`
          : "crm.messengers.failed",
        { type: "error" },
      ),
  });
  const disconnect = useMutation({
    mutationFn: () => dataProvider.disconnectMessenger(kind),
    onSuccess: () => {
      setConnection(null);
      onChange();
    },
    onError: () => notify("crm.messengers.failed", { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isFilled) connect.mutate();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <ChannelIcon kind={kind} />
        {translate(`crm.chats.channels.${kind}`)}
      </h3>
      {connected ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Check className="size-4 text-primary" />
              {translate("crm.messengers.on", { name: connected.name })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {translate("crm.channels.disconnect")}
            </Button>
          </div>
          {connection ? (
            <WebhookDetails kind={kind} connection={connection} />
          ) : null}
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {translate(`crm.messengers.${kind}.hint`)}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {STEPS.map((step) => (
              <li key={step}>
                {translate(`crm.messengers.${kind}.steps.${step}`)}
              </li>
            ))}
          </ol>
          {fields.map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={`${kind}-${field}`}>
                {translate(`crm.messengers.fields.${field}`)}
              </Label>
              <Input
                id={`${kind}-${field}`}
                type={field === "phone_number_id" ? "text" : "password"}
                inputMode={field === "phone_number_id" ? "numeric" : undefined}
                autoComplete="off"
                value={values[field] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field]: event.target.value })
                }
              />
            </div>
          ))}
          <Button
            type="submit"
            className="self-start"
            disabled={!isFilled || connect.isPending}
          >
            {translate("crm.channels.connect")}
          </Button>
        </form>
      )}
    </div>
  );
};

/** The address and the token the owner enters in the Meta app dashboard. */
const WebhookDetails = ({
  kind,
  connection,
}: {
  kind: MessengerKind;
  connection: MessengerConnection;
}) => {
  const translate = useTranslate();
  if (kind === "viber") {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          connection.webhook_url
            ? "crm.messengers.viber.ready"
            : "crm.messengers.offline",
        )}
      </p>
    );
  }
  if (!connection.webhook_url) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("crm.messengers.offline")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">
        {translate("crm.messengers.webhook_hint")}
      </p>
      <CopyRow
        label={translate("crm.messengers.webhook_url")}
        value={connection.webhook_url}
      />
      {connection.verify_token ? (
        <CopyRow
          label={translate("crm.messengers.verify_token")}
          value={connection.verify_token}
        />
      ) : null}
    </div>
  );
};

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const translate = useTranslate();
  const notify = useNotify();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={translate("crm.messengers.copy", { label })}
        onClick={() =>
          navigator.clipboard
            .writeText(value)
            .then(() => notify("crm.messengers.copied", { type: "success" }))
            .catch(() => notify("crm.messengers.failed", { type: "error" }))
        }
      >
        <Copy />
      </Button>
    </div>
  );
};
