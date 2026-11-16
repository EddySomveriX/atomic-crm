import {
  useGetOne,
  useNotify,
  usePermissions,
  useTranslate,
  useUpdate,
  type Identifier,
} from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ReliabilityBadge } from "./ReliabilityBadge";
import { reliabilityReasons } from "./reliabilityReasons";
import type { ClientReliability } from "./types";

const AUTO = "auto";
const CHOICES = [AUTO, "reliable", "unreliable"] as const;

/**
 * The reliability of a client on their card: the level, what it is made of
 * over the last twelve months, and the choice to trust a client or to keep
 * them away from online booking whatever their history says.
 */
export const ReliabilityCard = ({ clientId }: { clientId: Identifier }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { permissions } = usePermissions();
  const { data, refetch } = useGetOne<ClientReliability>("client_reliability", {
    id: clientId,
  });
  const [update] = useUpdate();
  if (!data) return null;
  const value = data.reliability_override ?? AUTO;
  const labelOf = (choice: string) =>
    translate(`crm.reliability.override.${choice}`);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {translate("crm.reliability.title")}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <ReliabilityBadge reliability={data} />
        <span className="text-sm text-muted-foreground">
          {reliabilityReasons(data, translate)}
        </span>
      </div>
      {permissions !== "accountant" ? (
        <Select
          value={value}
          onValueChange={(next) =>
            update(
              "companies",
              {
                id: clientId,
                data: { reliability_override: next === AUTO ? null : next },
                previousData: { id: clientId },
              },
              {
                mutationMode: "pessimistic",
                onSuccess: () => refetch(),
                onError: () =>
                  notify("crm.reliability.failed", { type: "error" }),
              },
            )
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label={translate("crm.reliability.override_label")}
          >
            <SelectValue>{labelOf(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHOICES.map((choice) => (
              <SelectItem key={choice} value={choice}>
                {labelOf(choice)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </section>
  );
};
