import type { Identifier } from "ra-core";

export const DOCUMENT_KINDS = [
  "contract",
  "invoice",
  "act",
  "waybill",
  "receipt",
  "photo",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** The largest file the documents bucket takes (supabase/schemas/21_documents.sql). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** File types the documents bucket takes. */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** What a document is attached to: a counterparty, contact, deal or booking. */
export interface DocumentLinks {
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  booking_id?: Identifier | null;
}

export interface CrmDocument extends DocumentLinks {
  id: Identifier;
  business_id: string;
  created_at: string;
  created_by: string | null;
  kind: DocumentKind;
  title: string;
  doc_date: string | null;
  /** Minor units of the business currency */
  amount: number | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  source: "upload" | "telegram" | "chat";
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface DocumentUploadInput extends DocumentLinks {
  file: File;
  kind: DocumentKind;
  title: string;
  doc_date?: string | null;
  amount?: number | null;
}

export interface SendDocumentResult {
  status: "sent" | "failed" | "no_chat";
  error?: string;
}

export type SaveAttachmentResult =
  | { status: "saved" | "duplicate"; document_id: Identifier; title?: string }
  | { status: "failed"; reason: "type" | "size" | "download" };

/** Thrown when the same file is already among the documents. */
export class DuplicateDocumentError extends Error {
  constructor(public readonly existing: Pick<CrmDocument, "id" | "title">) {
    super("The same file is already among the documents");
    this.name = "DuplicateDocumentError";
  }
}
