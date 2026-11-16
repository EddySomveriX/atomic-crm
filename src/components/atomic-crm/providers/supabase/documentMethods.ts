import { HttpError, type Identifier } from "ra-core";

import {
  documentMimeType,
  safeFileName,
  sha256Hex,
} from "../../documents/documentFiles";
import {
  DuplicateDocumentError,
  type CrmDocument,
  type DocumentUploadInput,
  type SaveAttachmentResult,
  type SendDocumentResult,
} from "../../documents/types";
import { getCurrentBusinessId } from "./authProvider";
import { invoke } from "./channelMethods";
import { getSupabaseClient } from "./supabase";

export const DOCUMENTS_BUCKET = "documents";

/** Seconds a link to a document works: an hour to open it, 7 days to share it. */
export const OPEN_LINK_SECONDS = 60 * 60;
export const SHARE_LINK_SECONDS = 7 * 24 * 60 * 60;

const randomFolder = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/** Files of the private documents bucket. */
export const documentMethods = {
  /**
   * Stores a file in the folder of the business and adds it to the documents.
   * The same file is stored once: a DuplicateDocumentError names the
   * document that already has it.
   */
  async uploadDocument(input: DocumentUploadInput): Promise<CrmDocument> {
    const supabase = getSupabaseClient();
    const mimeType = documentMimeType(input.file);
    if (mimeType == null) {
      throw new HttpError("This type of file is not accepted", 400);
    }
    const checksum = await sha256Hex(input.file);
    const { data: existing, error: lookupError } = await supabase
      .from("documents")
      .select("id, title")
      .eq("checksum", checksum)
      .is("deleted_at", null)
      .limit(1);
    if (lookupError) throw new HttpError(lookupError.message, 400, lookupError);
    if (existing && existing.length > 0) {
      throw new DuplicateDocumentError(existing[0]);
    }

    const businessId = await getCurrentBusinessId();
    const fileName = safeFileName(input.file.name);
    const filePath = `${businessId}/${randomFolder()}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, input.file, { contentType: mimeType });
    if (uploadError) {
      throw new HttpError(uploadError.message, 400, uploadError);
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        kind: input.kind,
        title: input.title.trim(),
        doc_date: input.doc_date || null,
        amount: input.amount ?? null,
        file_path: filePath,
        file_name: input.file.name.slice(0, 255),
        mime_type: mimeType,
        size_bytes: input.file.size,
        checksum,
        company_id: input.company_id ?? null,
        contact_id: input.contact_id ?? null,
        deal_id: input.deal_id ?? null,
        booking_id: input.booking_id ?? null,
      })
      .select()
      .single();
    // A file left without its row is removed by documents_purge
    if (error) throw new HttpError(error.message, 400, error);
    return data as CrmDocument;
  },

  /**
   * Sends a document to its client in Telegram; "no_chat" when the client
   * has no Telegram chat with the bot.
   */
  sendDocument(documentId: Identifier): Promise<SendDocumentResult> {
    return invoke("document_send", "POST", { document_id: documentId });
  },

  /** Saves a file or photo a client sent in a chat to the documents. */
  saveChatAttachment(messageId: Identifier): Promise<SaveAttachmentResult> {
    return invoke("chat_attachment_save", "POST", { message_id: messageId });
  },

  /** A link that opens the file of a document for a while. */
  async documentLink(
    filePath: string,
    seconds: number = OPEN_LINK_SECONDS,
    download?: string,
  ): Promise<string> {
    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, seconds, download ? { download } : undefined);
    if (error || !data) {
      throw new HttpError(error?.message ?? "No link", 400, error);
    }
    return data.signedUrl;
  },
};
