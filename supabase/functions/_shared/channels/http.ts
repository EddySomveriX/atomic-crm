import * as jose from "jsr:@panva/jose@6";
import { corsHeaders } from "../cors.ts";

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const SIGNING_KEYS = jose.createRemoteJWKSet(
  new URL(Deno.env.get("SUPABASE_URL")! + "/auth/v1/.well-known/jwks.json"),
);

/**
 * A call made by the server itself (a scheduled job, or the local runner
 * scripts/channels-dev.mjs): it carries a service role token signed by the
 * project. The gateway may re-sign the token, so its signature and role are
 * checked rather than compared with a stored copy.
 */
export const isServiceRequest = async (req: Request): Promise<boolean> => {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) return false;
  try {
    const { payload } = await jose.jwtVerify(token, SIGNING_KEYS);
    return payload.role === "service_role";
  } catch {
    return false;
  }
};

/** Compares two secrets in a time that does not depend on where they differ. */
export const sameSecret = (a: string | null, b: string | null): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
};
