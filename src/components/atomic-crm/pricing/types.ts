import type { Identifier, RaRecord } from "ra-core";

export const PROMOTION_KINDS = [
  "happy_hours",
  "last_minute",
  "first_visit",
  "promo_code",
] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export interface Promotion extends RaRecord {
  kind: PromotionKind;
  name: string;
  percent: number;
  /** Services it applies to; empty: every service */
  product_ids: Identifier[];
  weekdays: number[];
  time_from: string | null;
  time_to: string | null;
  within_hours: number | null;
  code: string | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
}

export interface Package extends RaRecord {
  name: string;
  product_id: Identifier;
  visits: number;
  /** Price of the whole package, in minor units */
  price: number;
  valid_days: number;
  active: boolean;
}

export type PaymentMethod = "cash" | "card";

export interface ClientPackage extends RaRecord {
  sold_at: string;
  package_id: Identifier;
  client_id: Identifier;
  product_id: Identifier;
  visits_total: number;
  visits_left: number;
  expires_at: string;
  price_paid: number;
  payment_method: PaymentMethod;
  status: "active" | "cancelled";
}

export interface GiftCertificate extends RaRecord {
  sold_at: string;
  code: string;
  /** An amount, or one service */
  amount: number | null;
  product_id: Identifier | null;
  balance: number | null;
  expires_at: string;
  buyer_name: string | null;
  recipient_name: string | null;
  price_paid: number;
  payment_method: PaymentMethod;
  status: "active" | "used" | "cancelled";
}

export interface CertificateUse extends RaRecord {
  created_at: string;
  certificate_id: Identifier;
  booking_id: Identifier;
  amount: number;
  reverses_id: Identifier | null;
}

export interface SpecialistPrice extends RaRecord {
  product_id: Identifier;
  sales_id: Identifier;
  price: number;
}

export interface PriceChange extends RaRecord {
  product_id: Identifier;
  changed_at: string;
  old_price: number | null;
  new_price: number | null;
}

export interface PriceQuote {
  list_price: number | null;
  price: number | null;
  promotion_id: Identifier | null;
  promotion_name: string | null;
  percent: number | null;
}
