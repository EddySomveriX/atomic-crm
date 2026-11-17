import { whatsappMediaUrl } from "../../../../connectors/meta/index.ts";
import type { InboundAttachment } from "../../../../connectors/messaging.ts";

/**
 * Downloads a file a client sent in Instagram, Messenger, WhatsApp or Viber.
 * The address comes from a delivery, so it is fetched only from the file
 * servers of those messengers, over https, and only up to a size.
 */

/** File servers of Meta and Viber: the host is one of these or ends with ".<one>" */
const FILE_HOSTS = ["fbcdn.net", "fbsbx.com", "cdninstagram.com", "viber.com"];

export class MessengerFileError extends Error {
  constructor(readonly reason: "download" | "size") {
    super(reason);
    this.name = "MessengerFileError";
  }
}

export const isMessengerFileUrl = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    FILE_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  );
};

export const downloadMessengerFile = async (
  attachment: InboundAttachment,
  accessToken: string | null,
  maxBytes: number,
): Promise<Blob> => {
  let url = attachment.url ?? null;
  let headers: Record<string, string> = {};
  try {
    if (attachment.media_id) {
      if (!accessToken) throw new MessengerFileError("download");
      url = await whatsappMediaUrl(attachment.media_id, {
        fetch,
        settings: { access_token: accessToken },
      });
      headers = { Authorization: `Bearer ${accessToken}` };
    }
    if (!url || !isMessengerFileUrl(url)) {
      throw new MessengerFileError("download");
    }
    const response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new MessengerFileError("download");
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      throw new MessengerFileError("size");
    }
    const file = await response.blob();
    if (file.size > maxBytes) throw new MessengerFileError("size");
    return file;
  } catch (error) {
    if (error instanceof MessengerFileError) throw error;
    throw new MessengerFileError("download");
  }
};
