import { useQueryClient } from "@tanstack/react-query";
import { Camera, FileUp, X } from "lucide-react";
import {
  useDataProvider,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { parsePrice } from "../pricing/priceList";
import type { CrmDataProvider } from "../providers/types";
import {
  documentMimeType,
  fileProblem,
  guessKind,
  isDrawableImage,
  photosToPdf,
  titleFromFileName,
} from "./documentFiles";
import {
  DOCUMENT_KINDS,
  DOCUMENT_MIME_TYPES,
  DuplicateDocumentError,
  type DocumentKind,
  type DocumentLinks,
} from "./types";

const todayIso = (): string => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/**
 * Adds documents: photos taken with the phone camera or files from the
 * device. Several photos of one paper document become one PDF, a page per
 * photo. The same file is stored once.
 */
export const DocumentUploadDialog = ({
  links,
  onClose,
}: {
  links: DocumentLinks;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [locale = "uk"] = useLocaleState();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [combine, setCombine] = useState(true);
  const [kind, setKind] = useState<DocumentKind>("other");
  const [title, setTitle] = useState("");
  const [docDate, setDocDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const accepted = files.filter((file) => fileProblem(file) == null);
  const rejected = files.filter((file) => fileProblem(file) != null);
  const canCombine =
    accepted.length > 1 &&
    accepted.every((file) => isDrawableImage(documentMimeType(file) ?? ""));
  const asOne = canCombine && combine;

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    const first = next.find((file) => fileProblem(file) == null);
    if (first && title === "") {
      const type = documentMimeType(first) ?? "";
      setKind(guessKind(type));
      setTitle(
        type.startsWith("image/")
          ? translate("crm.documents.photo_title", {
              date: new Date(`${docDate}T12:00:00`).toLocaleDateString(locale),
            })
          : titleFromFileName(first.name),
      );
    }
  };

  const removeFile = (index: number) =>
    setFiles(files.filter((_, position) => position !== index));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The dialog may open inside another form (the booking): keep it out
    event.stopPropagation();
    if (accepted.length === 0 || title.trim() === "") return;
    const minorAmount = amount.trim() === "" ? null : parsePrice(amount);
    if (amount.trim() !== "" && minorAmount == null) {
      notify("crm.documents.amount_invalid", { type: "warning" });
      return;
    }
    setSaving(true);
    try {
      const uploads = asOne
        ? [await photosToPdf(accepted, title.trim())]
        : accepted;
      let saved = 0;
      for (const [index, file] of uploads.entries()) {
        const fileTitle =
          uploads.length === 1
            ? title.trim()
            : `${title.trim()} (${index + 1})`.slice(0, 200);
        try {
          await dataProvider.uploadDocument({
            ...links,
            file,
            kind,
            title: fileTitle,
            doc_date: docDate || null,
            amount: minorAmount,
          });
          saved += 1;
        } catch (error: unknown) {
          if (error instanceof DuplicateDocumentError) {
            notify("crm.documents.duplicate", {
              type: "warning",
              messageArgs: { title: error.existing.title },
            });
          } else {
            throw error;
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (saved > 0) {
        notify("crm.documents.saved", {
          type: "success",
          messageArgs: { smart_count: saved },
        });
        onClose();
      }
    } catch {
      notify("crm.documents.failed", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{translate("crm.documents.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1"
              onClick={() => cameraInput.current?.click()}
            >
              <Camera className="size-5" />
              {translate("crm.documents.take_photo")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp className="size-5" />
              {translate("crm.documents.choose_file")}
            </Button>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept={[...DOCUMENT_MIME_TYPES, ".heic", ".heif"].join(",")}
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {files.map((file, index) => {
                const problem = fileProblem(file);
                return (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        problem && "text-muted-foreground line-through",
                      )}
                    >
                      {file.name}
                    </span>
                    {problem ? (
                      <span className="text-xs text-destructive">
                        {translate(`crm.documents.problems.${problem}`)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                      aria-label={translate("crm.documents.remove_file")}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {translate("crm.documents.pick_hint")}
            </p>
          )}

          {canCombine ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={combine}
                onCheckedChange={(checked) => setCombine(checked === true)}
              />
              {translate("crm.documents.combine", {
                smart_count: accepted.length,
              })}
            </label>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>{translate("crm.documents.kind")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DOCUMENT_KINDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={kind === item}
                  onClick={() => setKind(item)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm",
                    kind === item
                      ? "border-primary bg-accent font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {translate(`crm.documents.kinds.${item}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-title">
              {translate("crm.documents.title_field")}
            </Label>
            <Input
              id="document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-date">
                {translate("crm.documents.date")}
              </Label>
              <Input
                id="document-date"
                type="date"
                value={docDate}
                onChange={(event) => setDocDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document-amount">
                {translate("crm.documents.amount")}
              </Label>
              <Input
                id="document-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="—"
                className="w-32"
              />
            </div>
          </div>

          {rejected.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {translate("crm.documents.accepted_hint")}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate("ra.action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || accepted.length === 0 || title.trim() === ""}
            >
              {translate(
                saving ? "crm.documents.saving" : "crm.documents.save",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
