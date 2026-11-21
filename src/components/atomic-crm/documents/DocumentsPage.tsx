import { Plus, Search } from "lucide-react";
import { useCanAccess, useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { DocumentRows } from "./DocumentRows";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { DOCUMENT_KINDS, type CrmDocument, type DocumentKind } from "./types";
import { LoadingRows } from "../misc/PageStates";
import { FileText } from "lucide-react";
import { EmptyState } from "../misc/PageStates";

const PAGE_SIZE = 50;

/**
 * All documents of the business: search by title, a filter by kind and, for
 * an owner, the trash (documents there are removed for good after 30 days).
 */
export const DocumentsPage = () => {
  const translate = useTranslate();
  const { canAccess: canAdd } = useCanAccess({
    resource: "documents",
    action: "create",
  });
  const { canAccess: isOwner } = useCanAccess({
    resource: "documents",
    action: "delete",
  });
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const query = params.get("q") ?? "";
  const kind = params.get("kind") as DocumentKind | null;
  const inTrash = params.get("trash") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
    setLimit(PAGE_SIZE);
  };

  const {
    data: documents = [],
    total = 0,
    isPending,
  } = useGetList<CrmDocument>("documents", {
    pagination: { page: 1, perPage: limit },
    sort: {
      field: inTrash ? "deleted_at" : "created_at",
      order: "DESC",
    },
    filter: {
      ...(inTrash ? { "deleted_at@not.is": null } : { "deleted_at@is": null }),
      ...(kind ? { kind } : {}),
      ...(query.trim() ? { "title@ilike": `%${query.trim()}%` } : {}),
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {translate(
            inTrash ? "crm.documents.trash_title" : "crm.documents.title",
          )}
        </h1>
        {inTrash || !canAdd ? null : (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {translate("crm.documents.add")}
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setParam("q", event.target.value)}
          placeholder={translate("crm.documents.search")}
          className="pl-9"
          aria-label={translate("crm.documents.search")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={kind == null} onClick={() => setParam("kind", null)}>
          {translate("crm.documents.all_kinds")}
        </Chip>
        {DOCUMENT_KINDS.map((item) => (
          <Chip
            key={item}
            active={kind === item}
            onClick={() => setParam("kind", item)}
          >
            {translate(`crm.documents.kinds.${item}`)}
          </Chip>
        ))}
      </div>

      {inTrash ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.documents.trash_hint")}
        </p>
      ) : null}

      {isPending ? (
        <LoadingRows />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={translate(
            inTrash
              ? "crm.documents.trash_empty_title"
              : query || kind
                ? "crm.documents.nothing_found_title"
                : "crm.documents.empty_title",
          )}
          text={translate(
            inTrash
              ? "crm.documents.trash_empty"
              : query || kind
                ? "crm.documents.nothing_found"
                : "crm.documents.empty",
          )}
        />
      ) : (
        <div className="rounded-lg border bg-card px-3">
          <DocumentRows documents={documents} inTrash={inTrash} />
        </div>
      )}

      {documents.length < total ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => setLimit(limit + PAGE_SIZE)}
        >
          {translate("crm.documents.more")}
        </Button>
      ) : null}

      {isOwner ? (
        <button
          type="button"
          onClick={() => setParam("trash", inTrash ? null : "1")}
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {translate(
            inTrash ? "crm.documents.back" : "crm.documents.open_trash",
          )}
        </button>
      ) : null}

      {adding ? (
        <DocumentUploadDialog links={{}} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
};

DocumentsPage.path = "/documents";

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1 text-sm",
      active
        ? "border-primary bg-accent font-medium"
        : "text-muted-foreground hover:bg-accent/60",
    )}
  >
    {children}
  </button>
);
