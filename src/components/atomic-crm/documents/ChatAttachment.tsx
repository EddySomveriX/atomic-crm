import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Image } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Message } from "../channels/types";
import { useModules } from "../modules/useModules";
import type { CrmDataProvider } from "../providers/types";

/**
 * A file in a chat: what a client sent (with a button that saves it to the
 * documents of the business) or a document sent to the client.
 */
export const ChatAttachment = ({ message }: { message: Message }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { isOn } = useModules();
  const { canAccess: canSave } = useCanAccess({
    resource: "documents",
    action: "create",
  });
  const [saving, setSaving] = useState(false);
  const attachment = message.attachment;
  const isPhoto = attachment?.kind === "photo";
  const Icon = isPhoto ? Image : FileText;
  const name = attachment
    ? isPhoto
      ? translate("crm.documents.chat_photo")
      : attachment.file_name
    : message.body.replace(/^\[file\]\s*/, "");

  const save = async () => {
    setSaving(true);
    try {
      const result = await dataProvider.saveChatAttachment(message.id);
      if (result.status === "failed") {
        notify(`crm.documents.chat_save_${result.reason}`, { type: "warning" });
      } else {
        notify(
          result.status === "saved"
            ? "crm.documents.chat_saved"
            : "crm.documents.chat_already",
          { type: "success" },
        );
        await queryClient.invalidateQueries({ queryKey: ["messages"] });
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
      }
    } catch {
      notify("crm.documents.failed", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{name}</span>
      </span>
      {attachment && isOn("documents") ? (
        message.document_id != null ? (
          <Link
            to="/documents"
            className="flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            <Check className="size-3.5" />
            {translate("crm.documents.chat_in_documents")}
          </Link>
        ) : canSave ? (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "self-start bg-background text-foreground",
            )}
          >
            {translate(
              saving ? "crm.documents.saving" : "crm.documents.chat_save",
            )}
          </button>
        ) : null
      ) : null}
    </span>
  );
};
