import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";

import type { Channel } from "../channels/types";
import type { CrmDataProvider } from "../providers/types";

/**
 * The member's own Telegram: a one-time link opens the bot of the business,
 * which from then on tells them of their new, moved and cancelled bookings.
 */
export const MyTelegram = ({
  linkedIds,
  onChange,
}: {
  linkedIds: readonly (string | number)[];
  onChange: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const [code, setCode] = useState<string | null>(null);
  const { data: channels = [], isPending } = useGetList<Channel>("channels", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
    filter: { kind: "telegram" },
  });
  const bot = channels.find((channel) => channel.enabled && channel.name);
  const isLinked = identity != null && linkedIds.includes(identity.id);

  const makeCode = async () => {
    try {
      setCode(await dataProvider.createStaffLinkCode());
    } catch {
      notify("crm.team.failed", { type: "error" });
    }
  };

  const unlink = async () => {
    if (identity == null) return;
    try {
      await dataProvider.unlinkStaffTelegram(identity.id);
      setCode(null);
      onChange();
      await queryClient.invalidateQueries({ queryKey: ["staff_telegram"] });
    } catch {
      notify("crm.team.failed", { type: "error" });
    }
  };

  if (isPending) return null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Send className="size-4 text-primary" />
        {translate("crm.team.my_telegram")}
      </h2>
      {!bot ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.team.no_bot")}{" "}
          <Link to="/business" className="text-primary hover:underline">
            {translate("crm.team.bot_settings")}
          </Link>
        </p>
      ) : isLinked ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{translate("crm.team.linked", { bot: `@${bot.name}` })}</span>
          <Button variant="ghost" size="sm" onClick={unlink}>
            {translate("crm.team.unlink")}
          </Button>
        </div>
      ) : code ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>{translate("crm.team.open_bot_hint")}</p>
          <a
            href={`https://t.me/${bot.name}?start=staff_${code}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ className: "self-start" })}
            onClick={() => window.setTimeout(onChange, 15_000)}
          >
            {translate("crm.team.open_bot")}
          </a>
          <p className="text-xs text-muted-foreground">
            {translate("crm.team.code_hint", { code })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={onChange}
          >
            {translate("crm.team.check_link")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            {translate("crm.team.link_hint")}
          </p>
          <Button className="self-start" onClick={makeCode}>
            {translate("crm.team.link")}
          </Button>
        </div>
      )}
    </section>
  );
};
