import {
  useCanAccess,
  useCreate,
  useGetList,
  useLocaleState,
  useNotify,
  usePermissions,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useModules } from "../modules/useModules";
import { PROMOTION_KINDS, type Promotion, type PromotionKind } from "./types";
import { useUndoableDelete } from "../misc/useUndoableDelete";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const weekdayName = (weekday: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, weekday)),
  );

/**
 * Offers (the "Акції" tab): happy hours, last-minute windows, a first-visit
 * discount and promo codes. They apply by themselves when a client books;
 * when several fit, only the biggest discount counts.
 */
export const OffersTab = () => {
  const translate = useTranslate();
  const { permissions } = usePermissions();
  const canEdit = permissions !== "accountant";
  const [creating, setCreating] = useState<PromotionKind | null>(null);
  const { data: offers = [] } = useGetList<Promotion>("promotions", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "created_at", order: "DESC" },
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {translate("crm.pricing.offers_hint")}
      </p>
      {canEdit ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROMOTION_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setCreating(kind)}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left hover:border-primary/50"
            >
              <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">
                  {translate(`crm.pricing.offer_kinds.${kind}.name`)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {translate(`crm.pricing.offer_kinds.${kind}.hint`)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {offers.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {offers.map((offer) => (
            <OfferRow key={String(offer.id)} offer={offer} canEdit={canEdit} />
          ))}
        </ul>
      ) : null}
      {creating ? (
        <OfferDialog kind={creating} onClose={() => setCreating(null)} />
      ) : null}
    </div>
  );
};

const OfferRow = ({
  offer,
  canEdit,
}: {
  offer: Promotion;
  canEdit: boolean;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const [update] = useUpdate<Promotion>();
  const deleteWithUndo = useUndoableDelete();
  const { modules } = useModules();
  const { canAccess: canWritePosts } = useCanAccess({
    resource: "posts",
    action: "edit",
  });
  const canPost =
    canWritePosts === true && (modules ?? []).includes("marketing");
  const condition = (() => {
    switch (offer.kind) {
      case "happy_hours":
        return `${offer.weekdays.map((day) => weekdayName(day, locale)).join(", ")} ${offer.time_from?.slice(0, 5)}–${offer.time_to?.slice(0, 5)}`;
      case "last_minute":
        return translate("crm.pricing.within_hours", {
          count: offer.within_hours,
        });
      case "promo_code":
        return `${offer.code}${offer.max_uses ? ` · ${offer.used_count}/${offer.max_uses}` : ` · ${offer.used_count}`}`;
      default:
        return translate("crm.pricing.offer_kinds.first_visit.name");
    }
  })();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <span className="w-14 text-lg font-semibold tabular-nums text-primary">
        −{offer.percent}%
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{offer.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {translate(`crm.pricing.offer_kinds.${offer.kind}.name`)} ·{" "}
          {condition}
        </span>
      </span>
      <Switch
        checked={offer.active}
        disabled={!canEdit}
        onCheckedChange={(active) =>
          update("promotions", {
            id: offer.id,
            data: { active },
            previousData: offer,
          })
        }
        aria-label={translate("crm.pricing.offer_active")}
      />
      {canPost ? (
        <Button
          variant="outline"
          size="sm"
          render={<Link to={`/marketing?offer=${offer.id}`} />}
          nativeButton={false}
        >
          <Megaphone />
          {translate("crm.marketing.post_about_offer")}
        </Button>
      ) : null}
      {canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label={translate("ra.action.delete")}
          onClick={() => deleteWithUndo("promotions", offer)}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </li>
  );
};

const OfferDialog = ({
  kind,
  onClose,
}: {
  kind: PromotionKind;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [locale = "uk"] = useLocaleState();
  const [create, { isPending }] = useCreate<Promotion>();
  const [name, setName] = useState(
    translate(`crm.pricing.offer_kinds.${kind}.name`),
  );
  const [percent, setPercent] = useState("10");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4]);
  const [timeFrom, setTimeFrom] = useState("10:00");
  const [timeTo, setTimeTo] = useState("13:00");
  const [withinHours, setWithinHours] = useState("3");
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validTo, setValidTo] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create(
      "promotions",
      {
        data: {
          kind,
          name: name.trim(),
          percent: Number(percent),
          ...(kind === "happy_hours"
            ? { weekdays, time_from: timeFrom, time_to: timeTo }
            : {}),
          ...(kind === "last_minute"
            ? { within_hours: Number(withinHours) }
            : {}),
          ...(kind === "promo_code"
            ? {
                code: code.trim().toUpperCase(),
                max_uses: maxUses ? Number(maxUses) : null,
              }
            : {}),
          valid_to: validTo || null,
        },
      },
      {
        onSuccess: onClose,
        onError: (error: unknown) =>
          notify(
            error instanceof Error && error.message.includes("code")
              ? "crm.pricing.code_invalid"
              : "crm.pricing.offer_failed",
            { type: "error" },
          ),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate(`crm.pricing.offer_kinds.${kind}.name`)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field id="offer-name" label={translate("crm.pricing.offer_name")}>
            <Input
              id="offer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </Field>
          <Field
            id="offer-percent"
            label={translate("crm.pricing.offer_percent")}
          >
            <Input
              id="offer-percent"
              type="number"
              min={1}
              max={90}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              required
              className="w-28"
            />
          </Field>
          {kind === "happy_hours" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{translate("crm.pricing.offer_days")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const on = weekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setWeekdays(
                            on
                              ? weekdays.filter((item) => item !== day)
                              : [...weekdays, day].sort(),
                          )
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm capitalize",
                          on
                            ? "border-primary bg-accent font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {weekdayName(day, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <Field
                  id="offer-from"
                  label={translate("resources.working_hours.fields.starts_at")}
                >
                  <Input
                    id="offer-from"
                    type="time"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    required
                  />
                </Field>
                <Field
                  id="offer-to"
                  label={translate("resources.working_hours.fields.ends_at")}
                >
                  <Input
                    id="offer-to"
                    type="time"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    required
                  />
                </Field>
              </div>
            </>
          ) : null}
          {kind === "last_minute" ? (
            <Field
              id="offer-within"
              label={translate("crm.pricing.offer_within")}
            >
              <Input
                id="offer-within"
                type="number"
                min={1}
                max={72}
                value={withinHours}
                onChange={(e) => setWithinHours(e.target.value)}
                required
                className="w-28"
              />
            </Field>
          ) : null}
          {kind === "promo_code" ? (
            <div className="flex gap-3">
              <Field
                id="offer-code"
                label={translate("crm.pricing.offer_code")}
              >
                <Input
                  id="offer-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SPRING-30"
                  required
                  pattern="[A-Za-z0-9-]{3,20}"
                />
              </Field>
              <Field
                id="offer-uses"
                label={translate("crm.pricing.offer_max_uses")}
              >
                <Input
                  id="offer-uses"
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-28"
                />
              </Field>
            </div>
          ) : null}
          <Field
            id="offer-until"
            label={translate("crm.pricing.offer_valid_to")}
          >
            <Input
              id="offer-until"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-44"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate("ra.action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isPending || (kind === "happy_hours" && weekdays.length === 0)
              }
            >
              {translate("crm.pricing.offer_create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);
