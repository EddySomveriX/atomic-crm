import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import { insertMessage, loadBotToken } from "../_shared/channels/delivery.ts";
import { downloadDocument } from "../_shared/documents.ts";
import { sendDocument } from "../../../connectors/telegram/index.ts";

/**
 * Sends a document to its client in Telegram (TZ section 6.4).
 * POST { document_id } → { status: "sent" | "failed" | "no_chat", error? }
 * The client is the counterparty of the document, of its contact, deal or
 * booking; the file goes to the latest Telegram chat with that client and is
 * recorded in the chat. "no_chat": the client has no Telegram chat with the
 * bot, so the member shares a link instead.
 */

const clientOf = async (document: {
  business_id: string;
  company_id: number | null;
  contact_id: number | null;
  deal_id: number | null;
  booking_id: number | null;
}): Promise<number | null> => {
  if (document.company_id != null) return document.company_id;
  const lookups: [string, number | null, string][] = [
    ["contacts", document.contact_id, "company_id"],
    ["deals", document.deal_id, "company_id"],
    ["bookings", document.booking_id, "client_id"],
  ];
  for (const [table, id, column] of lookups) {
    if (id == null) continue;
    const { data } = await supabaseAdmin
      .from(table)
      .select(column)
      .eq("id", id)
      .eq("business_id", document.business_id)
      .maybeSingle();
    const clientId = (data as Record<string, number | null> | null)?.[column];
    if (clientId != null) return clientId;
  }
  return null;
};

async function send(req: Request, user: User) {
  const context = await getBusinessContext(user.id);
  if (!context || context.role === "accountant") {
    return createErrorResponse(403, "Forbidden");
  }
  let payload: { document_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const { data: document } = await supabaseAdmin
    .from("documents")
    .select(
      "id, business_id, title, file_path, file_name, company_id, contact_id, deal_id, booking_id",
    )
    .eq("id", Number(payload.document_id))
    .eq("business_id", context.business_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return createErrorResponse(404, "Document not found");

  const clientId = await clientOf(document);
  if (clientId == null) return jsonResponse({ status: "no_chat" });
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, business_id, channel_id, external_id, channels!inner(kind)")
    .eq("business_id", context.business_id)
    .eq("client_id", clientId)
    .eq("channels.kind", "telegram")
    .eq("channels.enabled", true)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) return jsonResponse({ status: "no_chat" });

  const sale = await getUserSale(user);
  let status: "sent" | "failed" = "sent";
  let externalId: string | null = null;
  let failure: string | undefined;
  try {
    const botToken = await loadBotToken(conversation.channel_id);
    const sent = await sendDocument(
      conversation.external_id,
      await downloadDocument(document.file_path),
      document.file_name,
      document.title,
      {
        fetch,
        timeoutMs: 60_000,
        settings: { botToken: botToken ?? undefined },
      },
    );
    externalId = String(sent.message_id);
  } catch (error) {
    status = "failed";
    failure = error instanceof Error ? error.message : "send failed";
  }
  await insertMessage({
    business_id: context.business_id,
    conversation_id: conversation.id,
    direction: "out",
    body: `[file] ${document.title}`,
    sales_id: sale?.id ?? null,
    external_id: externalId,
    status,
    error: failure ?? null,
    document_id: document.id,
  });
  return jsonResponse({ status, error: failure });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        if (req.method !== "POST" || !user) {
          return createErrorResponse(405, "Method Not Allowed");
        }
        return send(req, user);
      }),
    ),
  ),
);
