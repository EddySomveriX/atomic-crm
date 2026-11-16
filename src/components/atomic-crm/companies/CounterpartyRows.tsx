import { useGetMany, useListContext, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Phone } from "lucide-react";

import { RoleBadges } from "../counterparties/CounterpartyInfo";
import { ReliabilityBadge } from "../reliability/ReliabilityBadge";
import type { ClientReliability } from "../reliability/types";
import type { Company } from "../types";
import { CompanyAvatar } from "./CompanyAvatar";

/**
 * Counterparties as a calm list (the redesign of the list page): one row per
 * counterparty with its avatar, name, kind, roles, phone and city, and the
 * reliability of clients that need watching.
 */
export const CounterpartyRows = () => {
  const translate = useTranslate();
  const { data = [] } = useListContext<Company>();
  const clientIds = data
    .filter((item) => item.roles?.includes("client"))
    .map((item) => item.id);
  const { data: reliabilities = [] } = useGetMany<ClientReliability>(
    "client_reliability",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {data.map((company) => {
        const reliability = reliabilities.find(
          (item) => item.id === company.id,
        );
        const showReliability =
          reliability?.level === "watch" || reliability?.level === "unreliable";
        return (
          <li key={String(company.id)}>
            <Link
              to={`/companies/${company.id}/show`}
              className="flex items-center gap-4 px-4 py-3 no-underline hover:bg-muted/50"
            >
              <CompanyAvatar record={company} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {company.name}
                  </span>
                  {showReliability ? (
                    <ReliabilityBadge reliability={reliability} />
                  ) : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {[
                    company.kind
                      ? translate(`crm.counterparty.kinds.${company.kind}`)
                      : null,
                    company.city,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
              {company.phone_number ? (
                <span className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
                  <Phone className="size-3.5" aria-hidden />
                  {company.phone_number}
                </span>
              ) : null}
              <span className="hidden sm:block">
                <RoleBadges roles={company.roles} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
