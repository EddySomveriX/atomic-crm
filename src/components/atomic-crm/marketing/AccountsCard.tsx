import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { CrmDataProvider } from "../providers/types";
import type { MarketingAccount } from "./types";
import { useUndoableDelete } from "../misc/useUndoableDelete";

/** Reasons the server gives for refusing an account, shown in plain words */
const KNOWN_ERRORS = [
  "no_bot",
  "channel_not_found",
  "bot_not_admin",
  "token_refused",
  "invalid_input",
];

const INSTAGRAM_STEPS = ["1", "2", "3", "4"] as const;

/**
 * Where posts go: the business's Telegram channel (through its bot) and its
 * Instagram business account (through a token from the Meta app dashboard).
 */
export const AccountsCard = ({
  accounts,
}: {
  accounts: MarketingAccount[];
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { canAccess: canEdit } = useCanAccess({
    resource: "marketing_accounts",
    action: "edit",
  });
  const [update] = useUpdate();
  const deleteWithUndo = useUndoableDelete();
  const onError = () => notify("crm.marketing.failed", { type: "error" });

  return (
    <div className="flex flex-col gap-4">
      {accounts.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {account.name}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {translate(`crm.marketing.account_kinds.${account.kind}`)}
                </span>
              </span>
              <Switch
                checked={account.enabled}
                disabled={!canEdit}
                aria-label={translate("crm.marketing.accounts.enabled")}
                onCheckedChange={(enabled) =>
                  update(
                    "marketing_accounts",
                    {
                      id: account.id,
                      data: { enabled },
                      previousData: account,
                    },
                    { onError },
                  )
                }
              />
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={translate("crm.marketing.accounts.remove", {
                    name: account.name,
                  })}
                  onClick={() =>
                    deleteWithUndo("marketing_accounts", account, {
                      errorMessage: "crm.marketing.failed",
                    })
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <>
          <ConnectTelegram />
          <ConnectInstagram />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate("crm.marketing.accounts.owner_only")}
        </p>
      )}
    </div>
  );
};

const useConnect = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isPending, setIsPending] = useState(false);

  const connect = async (
    input: Parameters<CrmDataProvider["connectMarketingAccount"]>[0],
    onDone: () => void,
  ) => {
    setIsPending(true);
    try {
      const { name } = await dataProvider.connectMarketingAccount(input);
      await queryClient.invalidateQueries({ queryKey: ["marketing_accounts"] });
      notify("crm.marketing.accounts.connected", {
        type: "success",
        messageArgs: { name },
      });
      onDone();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      notify(
        KNOWN_ERRORS.includes(reason)
          ? translate(`crm.marketing.accounts.errors.${reason}`)
          : "crm.marketing.failed",
        { type: "error" },
      );
    } finally {
      setIsPending(false);
    }
  };
  return { connect, isPending };
};

const ConnectTelegram = () => {
  const translate = useTranslate();
  const { connect, isPending } = useConnect();
  const [channel, setChannel] = useState("");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {translate("crm.marketing.accounts.telegram_title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.marketing.accounts.telegram_hint")}
          </p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!channel.trim()) return;
            connect({ kind: "telegram_channel", channel: channel.trim() }, () =>
              setChannel(""),
            );
          }}
        >
          <Input
            aria-label={translate("crm.marketing.accounts.channel")}
            placeholder="@my_salon_news"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="min-w-48 flex-1"
          />
          <Button type="submit" disabled={!channel.trim() || isPending}>
            {translate("crm.marketing.accounts.connect")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ConnectInstagram = () => {
  const translate = useTranslate();
  const { connect, isPending } = useConnect();
  const [token, setToken] = useState("");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {translate("crm.marketing.accounts.instagram_title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.marketing.accounts.instagram_hint")}
          </p>
        </div>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {INSTAGRAM_STEPS.map((step) => (
            <li key={step}>
              {translate(`crm.marketing.accounts.instagram_steps.${step}`)}
            </li>
          ))}
        </ol>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!token.trim()) return;
            connect({ kind: "instagram", access_token: token.trim() }, () =>
              setToken(""),
            );
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            aria-label={translate("crm.marketing.accounts.token")}
            placeholder={translate("crm.marketing.accounts.token")}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="min-w-48 flex-1"
          />
          <Button type="submit" disabled={!token.trim() || isPending}>
            {translate("crm.marketing.accounts.connect")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {translate("crm.marketing.accounts.token_note")}
        </p>
      </CardContent>
    </Card>
  );
};
