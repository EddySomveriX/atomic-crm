import { Loader2 } from "lucide-react";
import { useTranslate } from "ra-core";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { callBookingPage, saveToken } from "./bookingApi";

const CODE_LENGTH = 6;

/**
 * Proves a phone number with a one-time SMS code; the key it gets is kept in
 * the browser so the client is not asked again for 30 days.
 */
export const PhoneCheck = ({
  slug,
  onVerified,
}: {
  slug: string;
  onVerified: (token: string, phone: string) => void;
}) => {
  const translate = useTranslate();
  const [phone, setPhone] = useState("+380");
  const [code, setCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const digits = phone.replace(/\D/g, "");

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setIsBusy(true);
    setProblem(null);
    try {
      const answer = await callBookingPage<{
        status: string;
        dev_code?: string;
      }>(slug, "send_code", { phone });
      if (answer.status === "too_many") {
        setProblem("crm.booking_page.code_too_many");
        return;
      }
      setIsCodeSent(true);
      setDevCode(answer.dev_code ?? null);
    } catch (error) {
      setProblem(
        error instanceof Error && error.message === "invalid_phone"
          ? "crm.booking_page.phone_invalid"
          : "crm.booking_page.failed",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setProblem(null);
    try {
      const answer = await callBookingPage<{ status: string; token?: string }>(
        slug,
        "verify_code",
        { phone, code },
      );
      if (answer.status === "verified" && answer.token) {
        saveToken(slug, answer.token);
        onVerified(answer.token, phone);
        return;
      }
      setProblem(
        answer.status === "wrong"
          ? "crm.booking_page.code_wrong"
          : "crm.booking_page.code_expired",
      );
    } catch {
      setProblem("crm.booking_page.failed");
    } finally {
      setIsBusy(false);
    }
  };

  return isCodeSent ? (
    <form onSubmit={verify} className="flex flex-col gap-3">
      <Label htmlFor="booking-code">
        {translate("crm.booking_page.code_label", { phone })}
      </Label>
      <Input
        id="booking-code"
        value={code}
        onChange={(event) =>
          setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        className="h-12 text-center text-2xl tracking-[0.5em] tabular-nums"
      />
      {devCode ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {translate("crm.booking_page.dev_code", { code: devCode })}
        </p>
      ) : null}
      {problem ? (
        <p className="text-sm text-destructive">{translate(problem)}</p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={code.length !== CODE_LENGTH || isBusy}
      >
        {isBusy ? <Loader2 className="animate-spin" /> : null}
        {translate("crm.booking_page.confirm_code")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => sendCode()}
        disabled={isBusy}
      >
        {translate("crm.booking_page.code_again")}
      </Button>
    </form>
  ) : (
    <form onSubmit={sendCode} className="flex flex-col gap-3">
      <Label htmlFor="booking-phone">
        {translate("crm.booking_page.phone")}
      </Label>
      <Input
        id="booking-phone"
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        autoComplete="tel"
        inputMode="tel"
        className="h-12 text-lg"
      />
      <p className="text-sm text-muted-foreground">
        {translate("crm.booking_page.code_hint")}
      </p>
      {problem ? (
        <p className="text-sm text-destructive">{translate(problem)}</p>
      ) : null}
      <Button type="submit" size="lg" disabled={digits.length < 10 || isBusy}>
        {isBusy ? <Loader2 className="animate-spin" /> : null}
        {translate("crm.booking_page.send_code")}
      </Button>
    </form>
  );
};
