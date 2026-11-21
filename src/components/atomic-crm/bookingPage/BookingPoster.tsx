import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { useTranslate } from "ra-core";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";

import { callBookingPage, type PageInfo } from "./bookingApi";
import { pageUrl } from "./pageSettings";

/** Pixels of the QR picture: sharp when printed on A4 */
const QR_SIZE = 1024;

/**
 * A poster to print and hang by the door: the name of the business, "book
 * online" and a QR code of the booking page; the QR alone can be saved as a
 * picture for Instagram.
 */
export const BookingPoster = () => {
  const translate = useTranslate();
  const { slug = "" } = useParams();
  const url = pageUrl(slug);
  const { data: info } = useQuery({
    queryKey: ["booking_page", slug],
    queryFn: () => callBookingPage<PageInfo>(slug, "page"),
    retry: false,
  });
  const { data: qr } = useQuery({
    queryKey: ["booking_qr", url],
    queryFn: () =>
      QRCode.toDataURL(url, {
        width: QR_SIZE,
        margin: 1,
        errorCorrectionLevel: "M",
      }),
  });

  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="flex justify-center gap-2 p-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer />
          {translate("crm.booking_page.print")}
        </Button>
        {qr ? (
          <Button
            variant="outline"
            render={<a href={qr} download={`qr-${slug}.png`} />}
            nativeButton={false}
          >
            <Download />
            {translate("crm.booking_page.download_qr")}
          </Button>
        ) : null}
      </div>
      <main className="mx-auto flex max-w-[150mm] flex-col items-center gap-6 px-6 py-10 text-center print:py-0">
        <h1 className="text-4xl font-semibold tracking-tight">
          {info?.business ?? ""}
        </h1>
        <p className="text-2xl">{translate("crm.booking_page.poster_title")}</p>
        {qr ? (
          <img
            src={qr}
            alt={translate("crm.booking_page.qr_alt")}
            className="w-[110mm] max-w-full"
          />
        ) : null}
        <p className="text-lg">{translate("crm.booking_page.poster_hint")}</p>
        <p className="break-all text-sm text-neutral-600">{url}</p>
      </main>
    </div>
  );
};

BookingPoster.path = "/book/:slug/poster";
