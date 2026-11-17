import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import { loadBotToken } from "../_shared/channels/delivery.ts";
import {
  MAX_DOCUMENT_BYTES,
  isAcceptedType,
  storeDocument,
} from "../_shared/documents.ts";
import {
  TelegramError,
  downloadFile,
} from "../../../connectors/telegram/index.ts";

import {
  MessengerFileError,
  downloadMessengerFile,
} from "../_shared/channels/messengerFiles.ts";

/**
 * Saves a file or photo a client sent in Telegram or a messenger to the documents of the
 * business, attached to the client of the chat (TZ section 6.4).
 * POST { message_id } → { status: "saved" | "duplicate", document_id, title }
 * or { status: "failed", reason: "type" | "size" | "download" }.
 */

interface Attachment {
  kind: "document" | "photo";
  /** Telegram */
  file_id?: string;
  /** Instagram, Messenger, Viber */
  url?: string;
  /** WhatsApp */
  media_id?: string;
  file_name: string;
  mime_type: string;
  size: number | null;
}

const isAttachment = (value: unknown): value is Attachment => {
  const item = value as Partial<Attachment> | null;
  return (
    (typeof item?.file_id === "string" ||
      typeof item?.url === "string" ||
      typeof item?.media_id === "string") &&
    typeof item.file_name === "string" &&
    typeof item.mime_type === "string"
  );
};

const UNKNOWN_TYPE = "application/octet-stream";

async function save(req: Request, user: User) {
  const context = await getBusinessContext(user.id);
  if (!context || context.role === "accountant") {
    return createErrorResponse(403, "Forbidden");
  }
  let payload: { message_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const { data: message } = await supabaseAdmin
    .from("messages")
    .select(
      "id, created_at, attachment, document_id, conversations!inner(channel_id, client_id, title)",
    )
    .eq("id", Number(payload.message_id))
    .eq("business_id", context.business_id)
    .eq("direction", "in")
    .maybeSingle();
  if (!message || !isAttachment(message.attachment)) {
    return createErrorResponse(404, "No file in this message");
  }
  if (message.document_id != null) {
    return jsonResponse({
      status: "duplicate",
      document_id: message.document_id,
    });
  }
  const attachment = message.attachment;
  // The messengers do not always name the type: it is read from the download
  if (
    attachment.mime_type !== UNKNOWN_TYPE &&
    !isAcceptedType(attachment.mime_type)
  ) {
    return jsonResponse({ status: "failed", reason: "type" });
  }
  if ((attachment.size ?? 0) > MAX_DOCUMENT_BYTES) {
    return jsonResponse({ status: "failed", reason: "size" });
  }
  const conversation = (
    Array.isArray(message.conversations)
      ? message.conversations[0]
      : message.conversations
  ) as { channel_id: number; client_id: number | null; title: string | null };

  let file: Blob;
  if (attachment.file_id) {
    try {
      const botToken = await loadBotToken(conversation.channel_id);
      file = await downloadFile(attachment.file_id, {
        fetch,
        timeoutMs: 60_000,
        settings: { botToken: botToken ?? undefined },
      });
    } catch (error) {
      if (!(error instanceof TelegramError)) throw error;
      return jsonResponse({ status: "failed", reason: "download" });
    }
  } else {
    const { data: secret } = await supabaseAdmin
      .from("channel_secrets")
      .select("access_token")
      .eq("channel_id", conversation.channel_id)
      .maybeSingle();
    try {
      file = await downloadMessengerFile(
        attachment,
        secret?.access_token ?? null,
        MAX_DOCUMENT_BYTES,
      );
    } catch (error) {
      if (!(error instanceof MessengerFileError)) throw error;
      return jsonResponse({ status: "failed", reason: error.reason });
    }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return jsonResponse({ status: "failed", reason: "size" });
  }
  const mimeType =
    attachment.mime_type === UNKNOWN_TYPE
      ? file.type.split(";")[0] || UNKNOWN_TYPE
      : attachment.mime_type;
  if (!isAcceptedType(mimeType)) {
    return jsonResponse({ status: "failed", reason: "type" });
  }

  const date = message.created_at.slice(0, 10);
  const title =
    attachment.kind === "photo"
      ? [conversation.title, date].filter(Boolean).join(", ")
      : attachment.file_name.replace(/\.[^.]+$/, "");
  const stored = await storeDocument({
    businessId: context.business_id,
    userId: user.id,
    file: new Blob([file], { type: mimeType }),
    fileName: attachment.file_name,
    mimeType,
    title: title || attachment.file_name,
    kind: attachment.kind === "photo" ? "photo" : "other",
    source: attachment.file_id ? "telegram" : "chat",
    companyId: conversation.client_id,
  });
  await supabaseAdmin
    .from("messages")
    .update({ document_id: stored.id })
    .eq("id", message.id);
  return jsonResponse({
    status: stored.duplicate ? "duplicate" : "saved",
    document_id: stored.id,
    title: stored.title,
  });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        if (req.method !== "POST" || !user) {
          return createErrorResponse(405, "Method Not Allowed");
        }
        return save(req, user);
      }),
    ),
  ),
);
