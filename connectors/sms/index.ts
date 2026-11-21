import { fetchWithTimeout, type ConnectorContext } from "../types.ts";

/**
 * SMS through TurboSMS (turbosms.ua), for one-time codes of the booking page.
 * The token and the sender name come in context.settings (token, sender),
 * read by the server from its environment (SMS_TOKEN, SMS_SENDER). Without
 * a token the connector is in "log" mode: nothing is sent, and the caller
 * writes the code to the server log so a developer can test the flow.
 * The response codes counted as accepted follow the TurboSMS API; check them
 * on a real account before relying on them.
 */

export const TURBOSMS_URL = "https://api.turbosms.ua/message/send.json";
/** Codes TurboSMS answers when it accepted a message */
const ACCEPTED_CODES = [0, 800, 801, 802, 803];

export class SmsError extends Error {
  constructor(
    readonly status: number,
    readonly description: string,
  ) {
    super(`SMS failed (${status}): ${description}`);
    this.name = "SmsError";
  }
}

/** Whether a real provider is configured; otherwise codes go to the log. */
export const isSmsConfigured = (context: ConnectorContext): boolean =>
  Boolean(context.settings?.token && context.settings?.sender);

/** "+380 67 123 45 67" → "380671234567"; null when it is not a phone number. */
export const phoneDigits = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

export const sendSms = async (
  phone: string,
  text: string,
  context: ConnectorContext,
): Promise<void> => {
  const token = context.settings?.token;
  const sender = context.settings?.sender;
  const digits = phoneDigits(phone);
  if (!token || !sender) throw new SmsError(0, "no SMS provider");
  if (!digits) throw new SmsError(0, "not a phone number");
  let response: Response;
  try {
    response = await fetchWithTimeout(context, TURBOSMS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [digits],
        sms: { sender, text },
      }),
    });
  } catch (error) {
    throw new SmsError(
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  const answer = (await response.json().catch(() => null)) as {
    response_code?: number;
    response_status?: string;
  } | null;
  if (
    !response.ok ||
    answer?.response_code == null ||
    !ACCEPTED_CODES.includes(answer.response_code)
  ) {
    throw new SmsError(
      answer?.response_code ?? response.status,
      answer?.response_status ?? "no answer",
    );
  }
};
