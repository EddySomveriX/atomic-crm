import { useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, RotateCw, Trash2 } from "lucide-react";
import {
  useDataProvider,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useBusinessTimeZone } from "../booking/useBookingData";
import type { CrmDataProvider } from "../providers/types";
import { MediaThumb } from "./MediaThumb";
import type { MarketingAccount, Post, PostTarget } from "./types";
import { useUndoableDelete } from "../misc/useUndoableDelete";
import { EmptyState, LoadingRows } from "../misc/PageStates";

/** How often the list looks for posts the server has published meanwhile */
const REFRESH_MS = 30_000;

const STATUS_VARIANT: Record<
  Post["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  scheduled: "secondary",
  published: "default",
  partly: "destructive",
  failed: "destructive",
};

/** Posts, the newest first: what is planned, what went out and what failed. */
export const PostList = ({
  accounts,
  canEdit,
  onEdit,
}: {
  accounts: MarketingAccount[];
  canEdit: boolean;
  onEdit: (post: Post, accountIds: PostTarget["account_id"][]) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const timeZone = useBusinessTimeZone();
  const [locale = "uk"] = useLocaleState();
  const deleteWithUndo = useUndoableDelete();
  const { data: posts = [], isPending } = useGetList<Post>(
    "posts",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "DESC" },
    },
    { refetchInterval: REFRESH_MS },
  );
  const { data: targets = [] } = useGetList<PostTarget>(
    "post_targets",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: posts.length
        ? { "post_id@in": `(${posts.map((post) => post.id).join(",")})` }
        : {},
    },
    { enabled: posts.length > 0, refetchInterval: REFRESH_MS },
  );
  const formatMoment = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  const onError = () => notify("crm.marketing.failed", { type: "error" });

  const retry = async (post: Post) => {
    try {
      await dataProvider.retryPost(post.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["post_targets"] }),
      ]);
      notify("crm.marketing.editor.publishing", { type: "success" });
    } catch {
      onError();
    }
  };

  if (isPending) return <LoadingRows />;
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title={translate("crm.marketing.no_posts_title")}
        text={translate("crm.marketing.no_posts")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {posts.map((post) => {
        const own = targets.filter((target) => target.post_id === post.id);
        const isSent = own.some((target) =>
          ["publishing", "published"].includes(target.status),
        );
        return (
          <li
            key={post.id}
            className="flex flex-col gap-2 rounded-lg border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={STATUS_VARIANT[post.status]}>
                {translate(`crm.marketing.statuses.${post.status}`)}
              </Badge>
              {post.format !== "post" ? (
                <Badge variant="outline">
                  {translate(`crm.marketing.formats.${post.format}`)}
                </Badge>
              ) : null}
              <span className="text-muted-foreground">
                {post.scheduled_at
                  ? formatMoment(post.scheduled_at)
                  : translate("crm.marketing.no_time")}
              </span>
              <span className="ml-auto flex gap-1">
                {canEdit && ["failed", "partly"].includes(post.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retry(post)}
                  >
                    <RotateCw />
                    {translate("crm.marketing.retry")}
                  </Button>
                ) : null}
                {canEdit && !isSent ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={translate("ra.action.edit")}
                      onClick={() =>
                        onEdit(
                          post,
                          own.map((target) => target.account_id),
                        )
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={translate("ra.action.delete")}
                      onClick={() =>
                        deleteWithUndo("posts", post, {
                          errorMessage: "crm.marketing.failed",
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : null}
              </span>
            </div>
            {post.text ? (
              <p className="line-clamp-4 whitespace-pre-line text-sm">
                {post.text}
              </p>
            ) : null}
            {post.media.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {post.media.map((item) => (
                  <MediaThumb key={item.path} media={item} />
                ))}
              </div>
            ) : null}
            <ul className="flex flex-col gap-0.5 text-sm">
              {own.map((target) => {
                const account = accounts.find(
                  (item) => item.id === target.account_id,
                );
                return (
                  <li key={target.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{account?.name ?? "—"}</span>
                    {post.status === "draft" ? null : target.status ===
                        "published" && target.url ? (
                      <a
                        href={target.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {translate("crm.marketing.open_post")}
                      </a>
                    ) : (
                      <span
                        className={
                          target.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {translate(
                          `crm.marketing.target_statuses.${target.status}`,
                        )}
                        {target.error
                          ? `: ${translate(`crm.marketing.errors.${target.error}`, { _: target.error })}`
                          : ""}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
};
