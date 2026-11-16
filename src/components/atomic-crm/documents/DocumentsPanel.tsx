import { Plus } from "lucide-react";
import { useCanAccess, useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { useModules } from "../modules/useModules";
import { DocumentRows } from "./DocumentRows";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import type { CrmDocument, DocumentLinks } from "./types";

/**
 * The documents of one counterparty, contact, deal or booking on its card,
 * with a button to add one. Hidden when the business has no documents module.
 */
export const DocumentsPanel = ({
  links,
  title = true,
}: {
  links: DocumentLinks;
  title?: boolean;
}) => {
  const translate = useTranslate();
  const { isOn } = useModules();
  const { canAccess: canAdd } = useCanAccess({
    resource: "documents",
    action: "create",
  });
  const [adding, setAdding] = useState(false);
  const filter = Object.fromEntries(
    Object.entries(links).filter(([, value]) => value != null),
  );
  const enabled = isOn("documents") && Object.keys(filter).length > 0;
  const { data: documents = [] } = useGetList<CrmDocument>(
    "documents",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "created_at", order: "DESC" },
      filter: { ...filter, "deleted_at@is": null },
    },
    { enabled },
  );
  if (!enabled) return null;

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        {title ? (
          <h3 className="text-lg font-semibold sm:text-sm sm:font-medium">
            {translate("crm.documents.title")}
          </h3>
        ) : null}
        {canAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" />
            {translate("crm.documents.add")}
          </Button>
        ) : null}
      </div>
      {documents.length > 0 ? (
        <DocumentRows documents={documents} compact />
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate("crm.documents.empty_card")}
        </p>
      )}
      {adding ? (
        <DocumentUploadDialog links={links} onClose={() => setAdding(false)} />
      ) : null}
    </section>
  );
};
