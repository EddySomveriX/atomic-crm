import { useQueryClient } from "@tanstack/react-query";
import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import {
  type Identifier,
  useDataProvider,
  useLocaleState,
  useNotify,
  useCanAccess,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState, type ReactNode } from "react";

import { formatMoney } from "../money/money";
import { useModules } from "../modules/useModules";
import { SHARE_LINK_SECONDS } from "../providers/supabase/documentMethods";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatFileSize } from "./documentFiles";
import type { CrmDocument } from "./types";

const iconOf = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  return File;
};

/**
 * Documents as rows: a tap opens the file; next to it, a 7-day link to share
 * and, for an owner, the trash (or, in the trash, restore).
 */
export const DocumentRows = ({
  documents,
  inTrash = false,
  compact = false,
  extraActions,
}: {
  documents: CrmDocument[];
  inTrash?: boolean;
  compact?: boolean;
  extraActions?: (document: CrmDocument) => ReactNode;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const { canAccess: isOwner } = useCanAccess({
    resource: "documents",
    action: "delete",
  });
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const [update] = useUpdate();
  const { isOn } = useModules();
  const { canAccess: canSend } = useCanAccess({
    resource: "documents",
    action: "edit",
  });
  const [sendingId, setSendingId] = useState<Identifier | null>(null);

  const hasClient = (document: CrmDocument) =>
    [
      document.company_id,
      document.contact_id,
      document.deal_id,
      document.booking_id,
    ].some((id) => id != null);

  const sendToClient = async (document: CrmDocument) => {
    setSendingId(document.id);
    try {
      const result = await dataProvider.sendDocument(document.id);
      notify(`crm.documents.send_${result.status}`, {
        type: result.status === "sent" ? "success" : "warning",
      });
    } catch {
      notify("crm.documents.send_failed", { type: "error" });
    } finally {
      setSendingId(null);
    }
  };

  const open = async (document: CrmDocument) => {
    // The window opens at once so that the browser does not block it
    const tab = window.open("", "_blank");
    try {
      const url = await dataProvider.documentLink(document.file_path);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch {
      tab?.close();
      notify("crm.documents.open_failed", { type: "error" });
    }
  };

  const share = async (document: CrmDocument) => {
    try {
      const url = await dataProvider.documentLink(
        document.file_path,
        SHARE_LINK_SECONDS,
        document.file_name,
      );
      await navigator.clipboard.writeText(url);
      notify("crm.documents.link_copied", { type: "info" });
    } catch {
      notify("crm.documents.open_failed", { type: "error" });
    }
  };

  const setTrashed = (document: CrmDocument, trashed: boolean) =>
    update(
      "documents",
      {
        id: document.id,
        data: { deleted_at: trashed ? new Date().toISOString() : null },
        previousData: document,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          notify(trashed ? "crm.documents.trashed" : "crm.documents.restored", {
            type: "info",
          });
        },
        onError: () => notify("crm.documents.failed", { type: "error" }),
      },
    );

  return (
    <ul className="flex flex-col divide-y">
      {documents.map((document) => {
        const Icon = iconOf(document.mime_type);
        const facts = [
          translate(`crm.documents.kinds.${document.kind}`),
          document.doc_date
            ? new Date(`${document.doc_date}T12:00:00`).toLocaleDateString(
                locale,
              )
            : null,
          document.amount != null
            ? formatMoney(document.amount, currency, locale)
            : null,
          compact ? null : formatFileSize(document.size_bytes, locale),
        ].filter(Boolean);
        return (
          <li key={document.id} className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => open(document)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-accent/60"
            >
              <Icon className="size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {document.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {facts.join(", ")}
                </span>
              </span>
            </button>
            {inTrash ? null : extraActions?.(document)}
            {!inTrash && canSend && isOn("chats") && hasClient(document) ? (
              <IconAction
                label={translate("crm.documents.send")}
                onClick={() => sendToClient(document)}
                disabled={sendingId === document.id}
              >
                <Send className="size-4" />
              </IconAction>
            ) : null}
            {inTrash ? null : (
              <IconAction
                label={translate("crm.documents.share")}
                onClick={() => share(document)}
              >
                <Link2 className="size-4" />
              </IconAction>
            )}
            {isOwner ? (
              inTrash ? (
                <IconAction
                  label={translate("crm.documents.restore")}
                  onClick={() => setTrashed(document, false)}
                >
                  <RotateCcw className="size-4" />
                </IconAction>
              ) : (
                <IconAction
                  label={translate("crm.documents.trash")}
                  onClick={() => setTrashed(document, true)}
                >
                  <Trash2 className="size-4" />
                </IconAction>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

export const IconAction = ({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
  >
    {children}
  </button>
);
