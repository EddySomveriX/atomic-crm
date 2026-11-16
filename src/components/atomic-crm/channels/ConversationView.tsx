import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { specialistName } from "../booking/types";
import { useSpecialists } from "../booking/useBookingData";
import type { CrmDataProvider } from "../providers/types";
import { ClientReliabilityBadge } from "../reliability/ReliabilityBadge";
import { ClientLink } from "./ClientLink";
import { TemplatesMenu } from "./TemplatesMenu";
import type { Channel, Conversation, Message } from "./types";
import { ChatAttachment } from "../documents/ChatAttachment";
import { messageCaption } from "../documents/chatFiles";

const REFRESH_MS = 5_000;
const UNASSIGNED = "none";

/**
 * One conversation of the chat center: its messages (the bot's too), who
 * answers it, the counterparty it belongs to, and the answer box with the
 * reply templates. An answer goes out through the channel of the client.
 */
export const ConversationView = ({
  conversation,
  name,
  channelKind,
  onBack,
}: {
  conversation: Conversation;
  name: string;
  channelKind?: Channel["kind"];
  onBack: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { specialists } = useSpecialists();
  const [update] = useUpdate<Conversation>();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useGetList<Message>(
    "messages",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
      filter: { conversation_id: conversation.id },
    },
    { refetchInterval: REFRESH_MS },
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: () =>
      dataProvider.sendChatMessage(conversation.id, text.trim()),
    onSuccess: (result) => {
      if (result.status === "failed") {
        notify("crm.chats.send_failed", { type: "error" });
      } else {
        setText("");
      }
      refetch();
    },
    onError: () => notify("crm.chats.send_failed", { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) send.mutate();
  };

  const change = (data: Partial<Conversation>) =>
    update("conversations", {
      id: conversation.id,
      data,
      previousData: conversation,
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label={translate("ra.action.back")}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="truncate">{name}</span>
            <ClientReliabilityBadge clientId={conversation.client_id} />
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {[
              channelKind
                ? translate(`crm.chats.channels.${channelKind}`)
                : null,
              conversation.phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <ClientLink conversation={conversation} name={name} />
        <Select
          value={
            conversation.assigned_to == null
              ? UNASSIGNED
              : String(conversation.assigned_to)
          }
          onValueChange={(value) =>
            change({
              assigned_to: value === UNASSIGNED ? null : Number(value),
            })
          }
        >
          <SelectTrigger
            className="w-40"
            aria-label={translate("crm.chats.assigned_to")}
          >
            <SelectValue>
              {specialistName(
                specialists.find(
                  (specialist) => specialist.id === conversation.assigned_to,
                ),
              ) || translate("crm.chats.unassigned")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>
              {translate("crm.chats.unassigned")}
            </SelectItem>
            {specialists.map((specialist) => (
              <SelectItem
                key={String(specialist.id)}
                value={String(specialist.id)}
              >
                {specialistName(specialist)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            change({
              status: conversation.status === "open" ? "closed" : "open",
            })
          }
        >
          {translate(
            conversation.status === "open"
              ? "crm.chats.close"
              : "crm.chats.reopen",
          )}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageBubble key={String(message.id)} message={message} />
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
        <TemplatesMenu onPick={(body) => setText(body)} />
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              submit(event);
            }
          }}
          placeholder={translate("crm.chats.answer_placeholder")}
          rows={2}
          maxLength={4096}
          className="min-h-11 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || send.isPending}
          aria-label={translate("crm.chats.send")}
        >
          <Send />
        </Button>
      </form>
    </div>
  );
};

const MessageBubble = ({ message }: { message: Message }) => {
  const translate = useTranslate();
  const fromClient = message.direction === "in";
  const fromBot = !fromClient && message.sales_id == null;
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-0.5",
        fromClient ? "self-start" : "self-end items-end",
      )}
    >
      <div
        className={cn(
          "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
          fromClient && "bg-muted",
          !fromClient && !fromBot && "bg-primary text-primary-foreground",
          fromBot && "border bg-background text-muted-foreground",
        )}
      >
        {message.attachment != null || message.document_id != null ? (
          <>
            <ChatAttachment message={message} />
            {messageCaption(message) ? (
              <span className="mt-1 block">{messageCaption(message)}</span>
            ) : null}
          </>
        ) : (
          message.body
        )}
      </div>
      <span className="px-1 text-xs text-muted-foreground">
        {[
          new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          fromBot ? translate("crm.chats.bot") : null,
          message.status === "failed"
            ? translate("crm.chats.not_delivered")
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
};
