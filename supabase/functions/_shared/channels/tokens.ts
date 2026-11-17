import { supabaseAdmin } from "../supabaseAdmin.ts";
import { refreshInstagramToken } from "../../../../connectors/meta/index.ts";

const DAY_MS = 24 * 3600 * 1000;
const REFRESH_BEFORE_DAYS = 10;

/**
 * Refreshes the Instagram tokens of the chat channels that end within 10
 * days, each at most once a day. A token that cannot be refreshed stays: the
 * chat then shows that the account must be connected again.
 */
export const refreshChannelTokens = async (): Promise<number> => {
  const now = Date.now();
  const { data } = await supabaseAdmin
    .from("channel_secrets")
    .select("channel_id, access_token")
    .not("access_token", "is", null)
    .lt(
      "token_expires_at",
      new Date(now + REFRESH_BEFORE_DAYS * DAY_MS).toISOString(),
    )
    .lt("refreshed_at", new Date(now - DAY_MS).toISOString());
  let refreshed = 0;
  for (const row of data ?? []) {
    const stamp = { refreshed_at: new Date(now).toISOString() };
    try {
      const fresh = await refreshInstagramToken({
        fetch,
        settings: { access_token: row.access_token },
      });
      await supabaseAdmin
        .from("channel_secrets")
        .update({
          ...stamp,
          access_token: fresh.access_token,
          token_expires_at: new Date(
            now + fresh.expires_in * 1000,
          ).toISOString(),
        })
        .eq("channel_id", row.channel_id);
      refreshed++;
    } catch {
      // No token in logs: the channel only
      console.error(`token refresh failed for channel ${row.channel_id}`);
      await supabaseAdmin
        .from("channel_secrets")
        .update(stamp)
        .eq("channel_id", row.channel_id);
    }
  }
  return refreshed;
};
