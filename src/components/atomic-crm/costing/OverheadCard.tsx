import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  useCanAccess,
  useCreate,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { formatMoney, getMinorDigits } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { OverheadItem } from "./types";
import { parseAmount } from "./useCostData";
import { useUndoableDelete } from "../misc/useUndoableDelete";

const MAX_MONTHS = 600;

/**
 * Expenses of a month the business pays whatever it sells: rent, utilities,
 * software, advertising, an administrator; equipment is spread over the
 * months it serves.
 */
export const OverheadCard = ({ monthly }: { monthly: number }) => {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const { canAccess: canEdit } = useCanAccess({
    resource: "overhead_items",
    action: "edit",
  });
  const deleteWithUndo = useUndoableDelete();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["cost_inputs"] });
  const { data: items = [] } = useGetList<OverheadItem>("overhead_items", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {translate("crm.costing.overhead.title")}
          </h2>
          <span className="text-lg font-semibold tabular-nums">
            {translate("crm.costing.overhead.per_month", {
              amount: money(monthly),
            })}
          </span>
        </div>
        {items.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-md border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  {item.kind === "equipment" ? (
                    <span className="block text-xs text-muted-foreground">
                      {translate("crm.costing.overhead.equipment_line", {
                        price: money(item.amount),
                        smart_count: Number(item.months),
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums">
                  {money(
                    item.kind === "equipment"
                      ? Math.round(item.amount / Number(item.months))
                      : item.amount,
                  )}
                </span>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={translate("crm.costing.remove", {
                      name: item.name,
                    })}
                    onClick={() =>
                      deleteWithUndo("overhead_items", item, {
                        onSuccess: refresh,
                        errorMessage: "crm.costing.failed",
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.costing.overhead.none")}
          </p>
        )}
        {canEdit ? <AddOverhead onAdded={refresh} key={items.length} /> : null}
      </CardContent>
    </Card>
  );
};

const AddOverhead = ({ onAdded }: { onAdded: () => void }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const { currency } = useConfigurationContext();
  const [create, { isPending }] = useCreate();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [isEquipment, setIsEquipment] = useState(false);
  const minor = parseAmount(amount, getMinorDigits(currency));
  const monthCount = Number(months);
  const isValid =
    name.trim() !== "" &&
    minor != null &&
    (!isEquipment ||
      (Number.isInteger(monthCount) &&
        monthCount >= 1 &&
        monthCount <= MAX_MONTHS));

  const add = () => {
    if (!isValid) return;
    create(
      "overhead_items",
      {
        data: {
          name: name.trim(),
          kind: isEquipment ? "equipment" : "monthly",
          amount: minor,
          months: isEquipment ? monthCount : null,
        },
      },
      {
        onSuccess: onAdded,
        onError: () => notify("crm.costing.failed", { type: "error" }),
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {[false, true].map((equipment) => (
          <button
            key={String(equipment)}
            type="button"
            role="radio"
            aria-checked={isEquipment === equipment}
            onClick={() => setIsEquipment(equipment)}
            className={
              isEquipment === equipment
                ? "rounded-full border border-primary bg-accent px-3 py-1 text-sm font-medium"
                : "rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-accent/60"
            }
          >
            {translate(
              equipment
                ? "crm.costing.overhead.equipment"
                : "crm.costing.overhead.monthly",
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          aria-label={translate("crm.costing.overhead.name")}
          placeholder={translate(
            isEquipment
              ? "crm.costing.overhead.equipment_placeholder"
              : "crm.costing.overhead.name_placeholder",
          )}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-48 flex-1"
        />
        <Input
          aria-label={translate(
            isEquipment
              ? "crm.costing.overhead.price"
              : "crm.costing.overhead.amount",
          )}
          placeholder={translate(
            isEquipment
              ? "crm.costing.overhead.price"
              : "crm.costing.overhead.amount",
          )}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="w-32"
        />
        {isEquipment ? (
          <Input
            aria-label={translate("crm.costing.overhead.months")}
            placeholder={translate("crm.costing.overhead.months")}
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            inputMode="numeric"
            className="w-28"
          />
        ) : null}
        <Button
          type="submit"
          variant="outline"
          disabled={!isValid || isPending}
        >
          {translate("ra.action.add")}
        </Button>
      </div>
    </form>
  );
};
