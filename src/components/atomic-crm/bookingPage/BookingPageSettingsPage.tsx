import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Copy, ExternalLink, Printer } from "lucide-react";
import {
  useCanAccess,
  useDataProvider,
  useNotify,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { instagramUsername } from "../marketing/types";
import type { CrmDataProvider } from "../providers/types";
import {
  SLUG_PATTERN,
  loadPageSettings,
  pageUrl,
  savePageSettings,
  slugFrom,
  type BookingPageSettings,
} from "./pageSettings";

/**
 * The owner's settings of the public booking page: its address, on or off,
 * the texts it shows, the link to share and the poster with the QR code.
 */
export const BookingPageSettingsPage = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: saved, isPending } = useQuery({
    queryKey: ["booking_page_settings"],
    queryFn: loadPageSettings,
  });
  const { data: business } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });
  if (isPending || !business) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <h1 className="text-2xl font-semibold">
        {translate("crm.booking_page.settings_title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {translate("crm.booking_page.settings_hint")}
      </p>
      <SettingsForm
        key={saved?.slug ?? "new"}
        saved={
          saved ?? {
            slug: slugFrom(business.name),
            enabled: false,
            about: null,
            address: null,
            phone: null,
            instagram: null,
          }
        }
      />
      {saved ? <ShareCard settings={saved} /> : null}
    </div>
  );
};

BookingPageSettingsPage.path = "/booking-page";

const SettingsForm = ({ saved }: { saved: BookingPageSettings }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { canAccess: canEdit } = useCanAccess({
    resource: "booking_pages",
    action: "edit",
  });
  const [values, setValues] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  const isSlugValid = SLUG_PATTERN.test(values.slug);
  const set = (patch: Partial<BookingPageSettings>) =>
    setValues({ ...values, ...patch });
  const optional = (value: string | null) => value?.trim() || null;

  const save = async () => {
    const instagram = values.instagram?.trim()
      ? instagramUsername(values.instagram)
      : null;
    if (values.instagram?.trim() && !instagram) {
      notify("crm.marketing.instagram_invalid", { type: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      await savePageSettings({
        ...values,
        about: optional(values.about),
        address: optional(values.address),
        phone: optional(values.phone),
        instagram,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking_page_settings"],
      });
      notify("crm.booking_page.saved", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error && error.message === "slug_taken"
          ? "crm.booking_page.slug_taken"
          : "crm.booking_page.failed",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    key: "address" | "phone" | "instagram",
    placeholder?: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`page-${key}`}>
        {translate(`crm.booking_page.fields.${key}`)}
      </Label>
      <Input
        id={`page-${key}`}
        value={values[key] ?? ""}
        placeholder={placeholder}
        disabled={!canEdit}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </div>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium">
            {translate("crm.booking_page.enabled")}
          </span>
          <Switch
            checked={values.enabled}
            disabled={!canEdit}
            onCheckedChange={(enabled) => set({ enabled })}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-slug">
            {translate("crm.booking_page.fields.slug")}
          </Label>
          <div className="flex items-center gap-1 text-sm">
            <span className="shrink-0 text-muted-foreground">…/#/book/</span>
            <Input
              id="page-slug"
              value={values.slug}
              disabled={!canEdit}
              onChange={(event) =>
                set({ slug: event.target.value.toLowerCase().trim() })
              }
            />
          </div>
          {!isSlugValid ? (
            <p className="text-sm text-destructive">
              {translate("crm.booking_page.slug_invalid")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-about">
            {translate("crm.booking_page.fields.about")}
          </Label>
          <Textarea
            id="page-about"
            value={values.about ?? ""}
            maxLength={1000}
            rows={3}
            disabled={!canEdit}
            onChange={(event) => set({ about: event.target.value })}
          />
        </div>
        {field("address")}
        {field("phone", "+380")}
        {field("instagram", "@")}
        {canEdit ? (
          <Button
            className="self-start"
            onClick={save}
            disabled={!isSlugValid || isSaving}
          >
            {translate("ra.action.save")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.booking_page.owner_only")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ShareCard = ({ settings }: { settings: BookingPageSettings }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const url = pageUrl(settings.slug);
  const { data: qr } = useQuery({
    queryKey: ["booking_qr", url],
    queryFn: () => QRCode.toDataURL(url, { width: 320, margin: 1 }),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        {qr ? (
          <img
            src={qr}
            alt={translate("crm.booking_page.qr_alt")}
            className="size-32 rounded-md border bg-white p-1"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm">
            {translate(
              settings.enabled
                ? "crm.booking_page.share_on"
                : "crm.booking_page.share_off",
            )}
          </p>
          <code className="truncate rounded bg-muted px-2 py-1 text-xs">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() =>
                    notify("crm.messengers.copied", { type: "success" }),
                  )
                  .catch(() =>
                    notify("crm.booking_page.failed", { type: "error" }),
                  )
              }
            >
              <Copy />
              {translate("crm.booking_page.copy_link")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href={url} target="_blank" rel="noreferrer" />}
              nativeButton={false}
              disabled={!settings.enabled}
            >
              <ExternalLink />
              {translate("crm.booking_page.open")}
            </Button>
            <Button
              size="sm"
              render={
                <a href={`${url}/poster`} target="_blank" rel="noreferrer" />
              }
              nativeButton={false}
              disabled={!settings.enabled}
            >
              <Printer />
              {translate("crm.booking_page.poster")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
