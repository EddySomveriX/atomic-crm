import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isServiceRequest, jsonResponse } from "../_shared/channels/http.ts";
import { DOCUMENTS_BUCKET } from "../_shared/documents.ts";

/**
 * Removes for good the documents an owner moved to the trash more than 30
 * days ago, and files left in the bucket without a document (an upload whose
 * row was never written) for more than a day.
 * Service role only (a scheduled job, or scripts/channels-dev.mjs).
 * → { removed, orphans }
 */

const TRASH_DAYS = 30;
const ORPHAN_HOURS = 24;
const BATCH = 100;

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function purgeTrash(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, file_path")
    .lt("deleted_at", daysAgo(TRASH_DAYS))
    .limit(BATCH);
  if (error) throw error;
  if (!data?.length) return 0;
  const { error: storageError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .remove(data.map((document) => document.file_path));
  if (storageError) throw storageError;
  const { error: deleteError } = await supabaseAdmin
    .from("documents")
    .delete()
    .in(
      "id",
      data.map((document) => document.id),
    );
  if (deleteError) throw deleteError;
  return data.length;
}

async function purgeOrphans(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("orphan_document_files", {
    p_before: daysAgo(ORPHAN_HOURS / 24),
  });
  if (error) throw error;
  const orphans = (data ?? []) as string[];
  if (!orphans.length) return 0;
  const { error: removeError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .remove(orphans);
  if (removeError) throw removeError;
  return orphans.length;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" || !(await isServiceRequest(req))) {
    return createErrorResponse(401, "Unauthorized");
  }
  try {
    return jsonResponse({
      removed: await purgeTrash(),
      orphans: await purgeOrphans(),
    });
  } catch (error) {
    console.error("documents purge failed:", error);
    return createErrorResponse(500, "Purge failed");
  }
});
