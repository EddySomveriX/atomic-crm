import type { Identifier, RaRecord } from "ra-core";

/** public.cost_settings, percents as numbers, money in minor units. */
export interface CostSettings {
  load_percent: number;
  pay_mode: "commission" | "hourly";
  hourly_rate: number | null;
  tax_percent: number;
  card_fee_percent: number;
  card_share_percent: number;
  target_margin_percent: number;
  material_price: "average" | "last";
}

export interface IncomeTax {
  code: string;
  rate: number;
  label: string;
}

/** What public.cost_inputs() returns. */
export interface CostInputs {
  settings: CostSettings;
  /** Expenses of a month, equipment spread over its months */
  overhead_monthly: number;
  /** Working minutes of all specialists in a month */
  working_minutes_month: number;
  /** Average commission of the team, null when nobody has one */
  commission_percent: number | null;
  /** Last purchase cost of a product by its id */
  last_costs: Record<string, number>;
  income_taxes: IncomeTax[];
}

/** A monthly expense or a piece of equipment (public.overhead_items). */
export interface OverheadItem extends RaRecord {
  name: string;
  kind: "monthly" | "equipment";
  /** The amount a month, or the price of the equipment */
  amount: number;
  months: number | null;
}

/** A line of its own in the cost of a product (public.product_cost_items). */
export interface ProductCostItem extends RaRecord {
  product_id: Identifier;
  name: string;
  amount: number | null;
  percent: number | null;
}
