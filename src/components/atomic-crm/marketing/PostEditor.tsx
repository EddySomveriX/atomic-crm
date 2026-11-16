import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import {
  useDataProvider,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { addDays, dayIn, timeIn, zonedDateTime } from "../booking/bookingTime";
import { useBusinessTimeZone } from "../booking/useBookingData";
import { isDrawableImage, photoAsJpeg } from "../documents/documentFiles";
import type { CrmDataProvider } from "../providers/types";
import { MediaThumb } from "./MediaThumb";
import {
  MAX_POST_MEDIA,
  MAX_POST_MEDIA_BYTES,
  MAX_POST_TEXT,
  POST_FORMATS,
  POST_MEDIA_TYPES,
  acceptsFormat,
  postProblem,
  type MarketingAccount,
  type Post,
  type PostFormat,
  type PostMedia,
} from "./types";

/** What the editor opens with: a post to change, or a ready text for a new one. */
export interface PostDraft {
  post?: Post;
  text?: string;
  source?: Post["source"];
  promotionId?: Identifier | null;
  /** Accounts the post already goes to */
  accountIds?: Identifier[];
}

const WHEN = ["now", "later"] as const;
type When = (typeof WHEN)[number];

const chip = (isOn: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-sm disabled:opacity-50",
    isOn
      ? "border-primary bg-accent font-medium"
      : "text-muted-foreground hover:bg-accent/60",
  );

/** Writes or changes a post: its text, photos or video, where and when it goes. */
export const PostEditor = ({
  draft,
  accounts,
  onClose,
}: {
  draft: PostDraft;
  /** Accounts that are switched on */
  accounts: MarketingAccount[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const fileInput = useRef<HTMLInputElement>(null);
  const { post } = draft;
  const planned = post?.scheduled_at ? new Date(post.scheduled_at) : null;
  const tomorrow = addDays(dayIn(new Date(), timeZone), 1);

  const [format, setFormat] = useState<PostFormat>(post?.format ?? "post");
  const [text, setText] = useState(post?.text ?? draft.text ?? "");
  const [media, setMedia] = useState<PostMedia[]>(post?.media ?? []);
  const [accountIds, setAccountIds] = useState<Identifier[]>(
    draft.accountIds ?? accounts.map((account) => account.id),
  );
  const [when, setWhen] = useState<When>(planned ? "later" : "now");
  const [day, setDay] = useState(planned ? dayIn(planned, timeZone) : tomorrow);
  const [time, setTime] = useState(
    planned ? timeIn(planned, timeZone) : "10:00",
  );
  const [isBusy, setIsBusy] = useState(false);

  const hasInstagram = accounts.some((account) => account.kind === "instagram");
  const offered = accounts.filter((account) =>
    acceptsFormat(account.kind, format),
  );
  const chosen = offered.filter((account) => accountIds.includes(account.id));
  const problem = postProblem({ format, text, media }, chosen);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setIsBusy(true);
    try {
      const added: PostMedia[] = [];
      for (const picked of Array.from(files).slice(
        0,
        MAX_POST_MEDIA - media.length,
      )) {
        if (picked.size > MAX_POST_MEDIA_BYTES) {
          notify("crm.marketing.editor.too_big", { type: "warning" });
          continue;
        }
        // Instagram takes JPEG photos only: other pictures are converted
        let file = picked;
        if (picked.type !== "image/jpeg" && isDrawableImage(picked.type)) {
          const bytes = await photoAsJpeg(picked);
          file = new File(
            [bytes as BlobPart],
            picked.name.replace(/\.[^.]+$/, "") + ".jpg",
            { type: "image/jpeg" },
          );
        }
        if (!(POST_MEDIA_TYPES as readonly string[]).includes(file.type)) {
          notify("crm.marketing.editor.wrong_type", { type: "warning" });
          continue;
        }
        added.push(await dataProvider.uploadPostMedia(file));
      }
      setMedia([...media, ...added]);
    } catch {
      notify("crm.marketing.failed", { type: "error" });
    } finally {
      setIsBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = async (asDraft: boolean) => {
    let scheduledAt: string | null = null;
    if (!asDraft) {
      const moment =
        when === "now" ? new Date() : zonedDateTime(day, time, timeZone);
      if (when === "later" && moment.getTime() < Date.now()) {
        notify("crm.marketing.editor.past", { type: "warning" });
        return;
      }
      scheduledAt = moment.toISOString();
    }
    setIsBusy(true);
    try {
      await dataProvider.savePost(
        {
          format,
          text: text.trim(),
          media,
          scheduled_at: scheduledAt,
          account_ids: chosen.map((account) => account.id),
          source: post?.source ?? draft.source ?? "manual",
          promotion_id: post?.promotion_id ?? draft.promotionId ?? null,
        },
        post?.id,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["post_targets"] }),
      ]);
      notify(
        asDraft
          ? "crm.marketing.editor.saved_draft"
          : when === "now"
            ? "crm.marketing.editor.publishing"
            : "crm.marketing.editor.scheduled",
        { type: "success" },
      );
      onClose();
    } catch {
      notify("crm.marketing.failed", { type: "error" });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {translate(
              post ? "crm.marketing.edit_post" : "crm.marketing.new_post",
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {hasInstagram ? (
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {POST_FORMATS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={format === item}
                  onClick={() => setFormat(item)}
                  className={chip(format === item)}
                >
                  {translate(`crm.marketing.formats.${item}`)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {translate("crm.marketing.editor.where")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {offered.map((account) => {
                const isOn = accountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isOn}
                    onClick={() =>
                      setAccountIds(
                        isOn
                          ? accountIds.filter((id) => id !== account.id)
                          : [...accountIds, account.id],
                      )
                    }
                    className={chip(isOn)}
                  >
                    {account.name}
                  </button>
                );
              })}
            </div>
          </div>

          {format === "story" ? null : (
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-sm font-medium">
                {translate("crm.marketing.editor.text")}
                <span
                  className={cn(
                    "font-normal tabular-nums text-muted-foreground",
                    text.length > MAX_POST_TEXT && "text-destructive",
                  )}
                >
                  {text.length} / {MAX_POST_TEXT}
                </span>
              </span>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                placeholder={translate("crm.marketing.editor.text_placeholder")}
              />
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {translate("crm.marketing.editor.media")}
            </span>
            <div className="flex flex-wrap gap-2">
              {media.map((item) => (
                <div key={item.path} className="relative">
                  <MediaThumb media={item} />
                  <button
                    type="button"
                    aria-label={translate("crm.marketing.editor.remove_media")}
                    onClick={() =>
                      setMedia(
                        media.filter((other) => other.path !== item.path),
                      )
                    }
                    className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {media.length < MAX_POST_MEDIA ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInput.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-accent/60 disabled:opacity-50"
                >
                  <ImagePlus className="size-5" />
                  {translate("ra.action.add")}
                </button>
              ) : null}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              multiple
              hidden
              onChange={(event) => addFiles(event.target.files)}
            />
            <span className="text-xs text-muted-foreground">
              {translate("crm.marketing.editor.media_hint")}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {translate("crm.marketing.editor.when")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {WHEN.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={when === item}
                  onClick={() => setWhen(item)}
                  className={chip(when === item)}
                >
                  {translate(`crm.marketing.editor.when_${item}`)}
                </button>
              ))}
            </div>
            {when === "later" ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  aria-label={translate("crm.marketing.editor.day")}
                  value={day}
                  onChange={(event) => setDay(event.target.value)}
                  className="w-40"
                />
                <Input
                  type="time"
                  aria-label={translate("crm.marketing.editor.time")}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="w-28"
                />
              </div>
            ) : null}
          </div>

          {problem ? (
            <p className="text-sm text-muted-foreground">
              {translate(problem)}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => save(true)}
            disabled={isBusy || (text.trim() === "" && media.length === 0)}
          >
            {translate("crm.marketing.editor.save_draft")}
          </Button>
          <Button
            onClick={() => save(false)}
            disabled={isBusy || problem != null || !day || !time}
          >
            {translate(
              when === "now"
                ? "crm.marketing.editor.publish_now"
                : "crm.marketing.editor.schedule",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
