import type { Message } from "../channels/types";

/** The text of a message without the file label the server put first. */
export const messageCaption = (message: Message): string => {
  if (message.attachment == null && message.document_id == null) {
    return message.body;
  }
  const [first, ...rest] = message.body.split("\n");
  return /^\[(file|photo)\]/.test(first) ? rest.join("\n") : message.body;
};
