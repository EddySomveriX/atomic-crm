import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { MessageSquareText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import type { ReplyTemplate } from "./types";

/**
 * Reply templates (TZ section 5.2): ready answers to frequent questions,
 * shared by the business. A click puts the text into the answer box, where
 * it can still be changed before sending.
 */
export const TemplatesMenu = ({
  onPick,
}: {
  onPick: (body: string) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data: templates = [] } = useGetList<ReplyTemplate>(
    "reply_templates",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "title", order: "ASC" },
    },
  );
  const [create, { isPending }] = useCreate<ReplyTemplate>();
  const [remove] = useDelete<ReplyTemplate>();

  const add = (event: FormEvent) => {
    event.preventDefault();
    create(
      "reply_templates",
      { data: { title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setAdding(false);
        },
        onError: () => notify("crm.chats.template_failed", { type: "error" }),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={translate("crm.chats.templates")}
          />
        }
      >
        <MessageSquareText />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">
            {translate("crm.chats.templates")}
          </p>
          {templates.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground">
              {translate("crm.chats.no_templates")}
            </p>
          ) : null}
          <ul className="flex max-h-60 flex-col overflow-y-auto">
            {templates.map((template) => (
              <li key={String(template.id)} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onPick(template.body);
                    setOpen(false);
                  }}
                >
                  <span className="block truncate font-medium">
                    {template.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {template.body}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={translate("ra.action.delete")}
                  onClick={() =>
                    remove("reply_templates", {
                      id: template.id,
                      previousData: template,
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form onSubmit={add} className="flex flex-col gap-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={translate("crm.chats.template_title")}
                maxLength={100}
                required
              />
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={translate("crm.chats.template_body")}
                rows={3}
                maxLength={4096}
                required
              />
              <Button type="submit" size="sm" disabled={isPending}>
                {translate("ra.action.save")}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setAdding(true)}
            >
              {translate("crm.chats.add_template")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
