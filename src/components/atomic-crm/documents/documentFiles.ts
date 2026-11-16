import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentKind,
} from "./types";

/** SHA-256 of a file as 64 hex characters (the documents checksum). */
export const sha256Hex = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const extensionOf = (name: string): string =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

/**
 * The type of a file, from the browser or, when the browser does not know it
 * (HEIC on Windows, for one), from its extension; null when not accepted.
 */
export const documentMimeType = (file: {
  name: string;
  type: string;
}): string | null => {
  const type = file.type || EXTENSION_TYPES[extensionOf(file.name)] || "";
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(type)
    ? type
    : null;
};

export type FileProblem = "type" | "size" | "empty";

/** Why a file cannot be a document, or null when it can. */
export const fileProblem = (file: {
  name: string;
  type: string;
  size: number;
}): FileProblem | null => {
  if (documentMimeType(file) == null) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_DOCUMENT_BYTES) return "size";
  return null;
};

/**
 * A file name that is safe in a storage path: no folders, no characters a
 * URL has to escape. Storage keys take Latin letters only, so other letters
 * drop out; the original name stays in documents.file_name.
 */
export const safeFileName = (name: string): string => {
  const extension = extensionOf(name);
  const base = (extension ? name.slice(0, -extension.length - 1) : name)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  const safeBase = base || "document";
  return extension ? `${safeBase}.${extension}` : safeBase;
};

/** The title a document gets from its file name. */
export const titleFromFileName = (name: string): string => {
  const extension = extensionOf(name);
  const base = extension ? name.slice(0, -extension.length - 1) : name;
  return base.replace(/[_]+/g, " ").trim().slice(0, 200) || name.slice(0, 200);
};

/** The kind a file most likely is, from its type. */
export const guessKind = (mimeType: string): DocumentKind =>
  mimeType.startsWith("image/") ? "photo" : "other";

/** Whether the browser can draw a picture of this type (and so put it in a PDF). */
export const isDrawableImage = (mimeType: string): boolean =>
  ["image/jpeg", "image/png", "image/webp"].includes(mimeType);

const MAX_PAGE_SIDE = 2000;

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The picture cannot be read"));
    };
    image.src = url;
  });

/** A photo as a JPEG no larger than 2000 px on its long side. */
const photoAsJpeg = async (file: Blob): Promise<Uint8Array> => {
  const image = await loadImage(file);
  const scale = Math.min(
    1,
    MAX_PAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The picture cannot be drawn");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("The picture cannot be saved");
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * Several photos of the pages of one paper document as one PDF, a page per
 * photo, in the order they were chosen.
 */
export const photosToPdf = async (
  photos: File[],
  title: string,
): Promise<File> => {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  for (const photo of photos) {
    const jpeg = await pdf.embedJpg(await photoAsJpeg(photo));
    const page = pdf.addPage([jpeg.width, jpeg.height]);
    page.drawImage(jpeg, {
      x: 0,
      y: 0,
      width: jpeg.width,
      height: jpeg.height,
    });
  }
  const bytes = await pdf.save();
  return new File([bytes as BlobPart], `${safeFileName(title)}.pdf`, {
    type: "application/pdf",
  });
};

/** "2,4 МБ" style size of a file. */
export const formatFileSize = (bytes: number, locale: string): string => {
  const units = locale.startsWith("uk") ? ["Б", "КБ", "МБ"] : ["B", "KB", "MB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`;
};
