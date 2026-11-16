import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Files of the private documents bucket on the server side
 * (supabase/schemas/21_documents.sql): the same rules as the browser upload
 * of src/components/atomic-crm/providers/supabase/documentMethods.ts.
 */

export const DOCUMENTS_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
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
]);

export const isAcceptedType = (mimeType: string): boolean =>
  ACCEPTED_TYPES.has(mimeType);

export const sha256Hex = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

/** A storage-safe file name (Latin letters, digits, dots and dashes). */
export const safeFileName = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "document";
  return extension ? `${base}.${extension}` : base;
};

const randomFolder = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export interface StoredDocument {
  id: number;
  title: string;
  duplicate: boolean;
}

/**
 * Stores a file in the folder of a business and adds it to its documents.
 * When the business already has the same file, nothing is stored and that
 * document is returned with duplicate: true.
 */
export const storeDocument = async (input: {
  businessId: string;
  userId: string;
  file: Blob;
  fileName: string;
  mimeType: string;
  title: string;
  kind: string;
  source: "upload" | "telegram" | "chat";
  companyId?: number | null;
}): Promise<StoredDocument> => {
  const checksum = await sha256Hex(input.file);
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("documents")
    .select("id, title")
    .eq("business_id", input.businessId)
    .eq("checksum", checksum)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { ...existing, duplicate: true };

  const filePath = `${input.businessId}/${randomFolder()}/${safeFileName(input.fileName)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, input.file, { contentType: input.mimeType });
  if (uploadError) throw uploadError;

  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      business_id: input.businessId,
      created_by: input.userId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      file_path: filePath,
      file_name: input.fileName.slice(0, 255),
      mime_type: input.mimeType,
      size_bytes: input.file.size,
      checksum,
      source: input.source,
      company_id: input.companyId ?? null,
    })
    .select("id, title")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
    throw error;
  }
  return { ...data, duplicate: false };
};

/** The file of a document. */
export const downloadDocument = async (filePath: string): Promise<Blob> => {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .download(filePath);
  if (error || !data) throw error ?? new Error("The file is missing");
  return data;
};
