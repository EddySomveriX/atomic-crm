import { useCanAccess, useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AccountsCard } from "./AccountsCard";
import { PostEditor, type PostDraft } from "./PostEditor";
import { PostList } from "./PostList";
import { FreeSlotsButton } from "./FreeSlotsButton";
import { OfferPostEditor } from "./OfferPostEditor";
import type { MarketingAccount } from "./types";
import { LoadingRows } from "../misc/PageStates";

const TABS = ["posts", "accounts"] as const;
type Tab = (typeof TABS)[number];

/**
 * Marketing: posts planned for the business's Telegram channel and Instagram
 * account, and the accounts themselves. The open tab is in the URL (?tab=).
 */
export const MarketingPage = () => {
  const translate = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab =
    searchParams.get("tab") === "accounts" ? "accounts" : "posts";
  // An offer of the price list to write a post about (?offer=<id>)
  const offerId = searchParams.get("offer");
  const { canAccess: canEdit } = useCanAccess({
    resource: "posts",
    action: "edit",
  });
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const { data: accounts = [], isPending } = useGetList<MarketingAccount>(
    "marketing_accounts",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const active = accounts.filter((account) => account.enabled);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {translate("crm.nav.marketing")}
        </h1>
        {canEdit && tab === "posts" && active.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <FreeSlotsButton onDraft={setDraft} />
            <Button onClick={() => setDraft({})}>
              <Plus />
              {translate("crm.marketing.new_post")}
            </Button>
          </div>
        ) : null}
      </div>
      <div role="tablist" className="flex gap-5 border-b">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === tab}
            onClick={() =>
              setSearchParams(item === "posts" ? {} : { tab: item })
            }
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2 text-sm",
              item === tab
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {translate(`crm.marketing.tabs.${item}`)}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <AccountsCard accounts={accounts} />
      ) : isPending ? (
        <LoadingRows />
      ) : active.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm">{translate("crm.marketing.no_accounts")}</p>
          <Button onClick={() => setSearchParams({ tab: "accounts" })}>
            {translate("crm.marketing.connect_first")}
          </Button>
        </div>
      ) : (
        <PostList
          accounts={accounts}
          canEdit={canEdit === true}
          onEdit={(post, accountIds) => setDraft({ post, accountIds })}
        />
      )}

      {offerId && !draft && canEdit && active.length > 0 ? (
        <OfferPostEditor
          offerId={offerId}
          accounts={active}
          onClose={() => setSearchParams({})}
        />
      ) : null}
      {draft ? (
        <PostEditor
          draft={draft}
          accounts={active}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
};

MarketingPage.path = "/marketing";
