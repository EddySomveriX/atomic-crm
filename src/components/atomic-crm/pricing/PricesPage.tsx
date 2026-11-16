import { useCanAccess, useTranslate } from "ra-core";
import { useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

import { CostsTab } from "../costing/CostsTab";
import { CertificatesTab } from "./CertificatesTab";
import { OffersTab } from "./OffersTab";
import { PackagesTab } from "./PackagesTab";
import { PriceListTab } from "./PriceListTab";

const TABS = ["prices", "offers", "packages", "certificates", "costs"] as const;
type Tab = (typeof TABS)[number];

/**
 * The "Прайс" section: prices, offers, packages and gift certificates on one
 * page, one tab each. The open tab is in the URL (?tab=).
 */
export const PricesPage = () => {
  const translate = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccess: canReadCosts } = useCanAccess({
    resource: "costs",
    action: "list",
  });
  const tabs = TABS.filter((item) => item !== "costs" || canReadCosts);
  const tab: Tab = (tabs as readonly string[]).includes(
    searchParams.get("tab") ?? "",
  )
    ? (searchParams.get("tab") as Tab)
    : "prices";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <h1 className="text-2xl font-semibold">{translate("crm.nav.pricing")}</h1>
      <div
        role="tablist"
        className="-mx-4 flex gap-5 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
      >
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === tab}
            onClick={() =>
              setSearchParams(item === "prices" ? {} : { tab: item })
            }
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2 text-sm",
              item === tab
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {translate(`crm.pricing.tabs.${item}`)}
          </button>
        ))}
      </div>
      {tab === "prices" ? <PriceListTab /> : null}
      {tab === "offers" ? <OffersTab /> : null}
      {tab === "packages" ? <PackagesTab /> : null}
      {tab === "certificates" ? <CertificatesTab /> : null}
      {tab === "costs" ? <CostsTab /> : null}
    </div>
  );
};

PricesPage.path = "/prices";
