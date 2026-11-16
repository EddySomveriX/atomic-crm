import {
  CalendarDays,
  ChartColumn,
  Handshake,
  Home,
  ListTodo,
  MessageCircle,
  Package,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { BusinessType } from "../business/types";

/**
 * Sections of the product a business turns on and off (the same list as the
 * businesses_modules check of supabase/schemas/17_modules.sql). Today,
 * counterparties and settings are always on.
 */
export const MODULE_KEYS = [
  "chats",
  "booking",
  "sales",
  "stock",
  "tasks",
  "analytics",
  "pricing",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Modules a kind of business starts with (public.default_modules). */
export const defaultModules = (
  businessType: BusinessType | null | undefined,
): ModuleKey[] => {
  switch (businessType) {
    case "services":
      return ["chats", "booking", "pricing", "tasks", "analytics"];
    case "retail":
      return ["chats", "sales", "stock", "pricing", "analytics"];
    case "production":
      return ["sales", "stock", "tasks", "analytics"];
    case "b2b":
      return ["chats", "sales", "tasks", "analytics"];
    default:
      return [...MODULE_KEYS];
  }
};

/** Modules that will join later; shown as "coming" in the module picker. */
export const COMING_MODULES = ["purchases", "money", "documents"] as const;

export interface NavPage {
  path: string;
  /** Translation key and its options for the label */
  labelKey: string;
  smartCount?: number;
}

export interface NavSection {
  key: string;
  /** The module that shows this section; null: always shown */
  module: ModuleKey | null;
  icon: LucideIcon;
  labelKey: string;
  /** The first page is where the section opens */
  pages: NavPage[];
}

/** The menu, in order. Pages of a section show under it when it is open. */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "today",
    module: null,
    icon: Home,
    labelKey: "crm.nav.today",
    pages: [{ path: "/", labelKey: "crm.nav.today" }],
  },
  {
    key: "chats",
    module: "chats",
    icon: MessageCircle,
    labelKey: "crm.nav.chats",
    pages: [{ path: "/chats", labelKey: "crm.nav.chats" }],
  },
  {
    key: "booking",
    module: "booking",
    icon: CalendarDays,
    labelKey: "crm.nav.booking",
    pages: [
      { path: "/calendar", labelKey: "crm.booking.calendar" },
      { path: "/working-hours", labelKey: "crm.booking.schedule" },
    ],
  },
  {
    key: "pricing",
    module: "pricing",
    icon: Tag,
    labelKey: "crm.nav.pricing",
    pages: [{ path: "/prices", labelKey: "crm.nav.pricing" }],
  },
  {
    key: "sales",
    module: "sales",
    icon: Handshake,
    labelKey: "crm.nav.sales",
    pages: [
      { path: "/deals", labelKey: "resources.deals.name", smartCount: 2 },
    ],
  },
  {
    key: "counterparties",
    module: null,
    icon: Users,
    labelKey: "crm.nav.counterparties",
    pages: [
      {
        path: "/companies",
        labelKey: "resources.companies.name",
        smartCount: 2,
      },
      { path: "/contacts", labelKey: "resources.contacts.name", smartCount: 2 },
    ],
  },
  {
    key: "stock",
    module: "stock",
    icon: Package,
    labelKey: "crm.nav.stock",
    pages: [
      { path: "/products", labelKey: "resources.products.name", smartCount: 2 },
      {
        path: "/stock_levels",
        labelKey: "resources.stock_levels.name",
        smartCount: 2,
      },
      {
        path: "/stock_moves",
        labelKey: "resources.stock_moves.name",
        smartCount: 2,
      },
      {
        path: "/warehouses",
        labelKey: "resources.warehouses.name",
        smartCount: 2,
      },
      { path: "/inventory", labelKey: "crm.nav.inventory" },
    ],
  },
  {
    key: "tasks",
    module: "tasks",
    icon: ListTodo,
    labelKey: "crm.nav.tasks",
    pages: [{ path: "/tasks", labelKey: "crm.nav.tasks" }],
  },
  {
    key: "analytics",
    module: "analytics",
    icon: ChartColumn,
    labelKey: "crm.nav.analytics",
    pages: [{ path: "/analytics", labelKey: "crm.nav.analytics" }],
  },
];

/** The sections of the menu for a set of modules. */
export const visibleSections = (
  modules: readonly ModuleKey[] | null | undefined,
): NavSection[] =>
  NAV_SECTIONS.filter(
    (section) =>
      section.module == null || (modules ?? []).includes(section.module),
  );

/** The section a path belongs to. */
export const sectionOfPath = (path: string): NavSection | undefined =>
  NAV_SECTIONS.find((section) =>
    section.pages.some((page) =>
      page.path === "/"
        ? path === "/"
        : path === page.path || path.startsWith(`${page.path}/`),
    ),
  );
