/** What public.business_analytics() returns (supabase/schemas/18_analytics.sql). */
export interface Analytics {
  currency: string;
  timezone: string;
  kpis: {
    revenue: number;
    sales_count: number;
    average_ticket: number;
    bookings: number;
    completed: number;
    no_show: number;
    cancelled: number;
    new_clients: number;
    clients_total: number;
    conversations: number;
    waiting_now: number;
    reply_minutes: number | null;
  };
  sales_by_month: { month: string; deals: number; bookings: number }[];
  bookings_by_month: {
    month: string;
    completed: number;
    booked: number;
    no_show: number;
    cancelled: number;
  }[];
  clients_by_month: { month: string; new_clients: number }[];
  busy_hours: { weekday: number; hour: number; bookings: number }[];
  top_clients: {
    id: number;
    name: string;
    revenue: number;
    visits: number;
    last_day: string | null;
  }[];
  top_services: {
    id: number;
    name: string;
    bookings: number;
    revenue: number;
  }[];
  specialists: {
    id: number;
    name: string;
    booked_minutes: number;
    working_minutes: number;
  }[];
  dormant_clients: {
    id: number;
    name: string;
    visits: number;
    last_day: string;
  }[];
  deals_by_stage: { stage: string; deals: number; amount: number }[];
  channels: { kind: "telegram" | "widget"; conversations: number }[];
  booking_sources: {
    source: "crm" | "telegram" | "widget";
    bookings: number;
  }[];
  stock: {
    products: number;
    in_stock: number;
    out_of_stock: number;
    value: number;
  };
}
