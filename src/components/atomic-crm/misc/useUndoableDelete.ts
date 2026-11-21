import { useDelete, useNotify, type RaRecord } from "ra-core";

/**
 * Deletes a record the way people expect from a modern app: it disappears at
 * once, and a notice offers "Undo" for a few seconds before the deletion
 * reaches the server. A failure shows the given message.
 */
export const useUndoableDelete = () => {
  const notify = useNotify();
  const [remove] = useDelete();

  return <T extends RaRecord>(
    resource: string,
    record: T,
    {
      onSuccess,
      errorMessage = "crm.undo.failed",
    }: { onSuccess?: () => void; errorMessage?: string } = {},
  ) =>
    remove(
      resource,
      { id: record.id, previousData: record },
      {
        mutationMode: "undoable",
        onSuccess: () => {
          notify("crm.undo.deleted", { type: "info", undoable: true });
          onSuccess?.();
        },
        onError: () => notify(errorMessage, { type: "error" }),
      },
    );
};
