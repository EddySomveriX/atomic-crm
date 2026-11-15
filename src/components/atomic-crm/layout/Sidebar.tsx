import {
  FileText,
  Import,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import {
  CanAccess,
  useGetList,
  useStore,
  useTranslate,
  useUserMenu,
} from "ra-core";
import { Link, useLocation } from "react-router";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Conversation } from "../channels/types";
import { useAppearance } from "../appearance/useAppearance";
import { ChangelogPage } from "../misc/ChangelogPage";
import { ImportPage } from "../misc/ImportPage";
import {
  sectionOfPath,
  visibleSections,
  type NavSection,
} from "../modules/modules";
import { useModules } from "../modules/useModules";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { GlobalSearchButton } from "../search/GlobalSearchButton";
import { BusinessMenu } from "./BusinessMenu";
import { QuickCreateButton } from "./QuickCreateButton";

const WAITING_REFRESH_MS = 30_000;

/**
 * The menu on the left (tablet and computer): the "+" and the search at the
 * top, the sections of the modules the business uses, the settings and the
 * profile at the bottom. The pages of the open section show under it. It
 * folds to icons; the choice is remembered on this device.
 */
export const Sidebar = () => {
  const translate = useTranslate();
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const { modules, isOn } = useModules();
  const { menuStyle } = useAppearance();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useStore<boolean>(
    "sidebar.collapsed",
    typeof window !== "undefined" && window.innerWidth < 1024,
  );
  const current = sectionOfPath(pathname);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-dvh shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-16 px-2" : "w-60 px-3",
      )}
    >
      <Link
        to="/"
        className="flex h-9 items-center gap-2 px-2 text-sidebar-foreground no-underline"
      >
        {menuStyle === "dark" ? (
          <img
            className="h-7 max-w-24 object-contain"
            src={darkModeLogo}
            alt=""
          />
        ) : (
          <>
            <img
              className="[.light_&]:hidden h-7 max-w-24 object-contain"
              src={darkModeLogo}
              alt=""
            />
            <img
              className="[.dark_&]:hidden h-7 max-w-24 object-contain"
              src={lightModeLogo}
              alt=""
            />
          </>
        )}
        {collapsed ? (
          <span className="sr-only">{title}</span>
        ) : (
          <span className="truncate text-base font-semibold">{title}</span>
        )}
      </Link>

      <div className="flex flex-col gap-2">
        <QuickCreateButton
          collapsed={collapsed}
          className={cn(
            "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
            collapsed ? "size-10 justify-center p-0" : "w-full justify-start",
          )}
        />
        <GlobalSearchButton
          variant={collapsed ? "icon" : "labelled"}
          className={
            collapsed
              ? "size-10 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              : "w-full justify-start border-sidebar-border bg-transparent px-3 font-normal text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }
        />
      </div>

      <nav
        aria-label={translate("crm.navigation.label")}
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1"
      >
        {visibleSections(modules).map((section) => (
          <SectionLink
            key={section.key}
            section={section}
            isActive={section === current}
            collapsed={collapsed}
            pathname={pathname}
            badge={
              section.key === "chats" && isOn("chats") ? <WaitingBadge /> : null
            }
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        <CanAccess resource="configuration" action="edit">
          <SidebarLink
            to="/business"
            icon={SlidersHorizontal}
            label={translate("crm.nav.settings")}
            isActive={pathname.startsWith("/business")}
            collapsed={collapsed}
          />
        </CanAccess>
        <div
          className={cn(
            "flex items-center gap-1",
            collapsed ? "flex-col" : "justify-between",
          )}
        >
          <UserMenu>
            <BusinessMenu />
            <ProfileMenu />
            <CanAccess resource="sales" action="list">
              <UsersMenu />
            </CanAccess>
            <CanAccess resource="configuration" action="edit">
              <SettingsMenu />
            </CanAccess>
            <ImportFromJsonMenuItem />
            <ChangelogMenuItem />
          </UserMenu>
          <div className={cn("flex", collapsed && "flex-col")}>
            <ThemeModeToggle />
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={translate(
                collapsed ? "crm.nav.expand" : "crm.nav.collapse",
              )}
              aria-expanded={!collapsed}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

const linkClasses = (isActive: boolean, collapsed: boolean) =>
  cn(
    "relative flex h-10 items-center gap-3 rounded-md text-sm no-underline outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed ? "justify-center px-0" : "px-3",
    isActive
      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );

const SidebarLink = ({
  to,
  icon: Icon,
  label,
  isActive,
  collapsed,
  badge,
}: {
  to: string;
  icon: NavSection["icon"];
  label: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: React.ReactNode;
}) => (
  <Link
    to={to}
    aria-current={isActive ? "page" : undefined}
    title={collapsed ? label : undefined}
    className={linkClasses(isActive, collapsed)}
  >
    <Icon className="size-5 shrink-0" />
    {collapsed ? (
      <span className="sr-only">{label}</span>
    ) : (
      <span className="flex-1 truncate">{label}</span>
    )}
    {badge}
  </Link>
);

const SectionLink = ({
  section,
  isActive,
  collapsed,
  pathname,
  badge,
}: {
  section: NavSection;
  isActive: boolean;
  collapsed: boolean;
  pathname: string;
  badge?: React.ReactNode;
}) => {
  const translate = useTranslate();
  const showPages = isActive && !collapsed && section.pages.length > 1;
  return (
    <div className="flex flex-col">
      <SidebarLink
        to={section.pages[0].path}
        icon={section.icon}
        label={translate(section.labelKey)}
        isActive={isActive}
        collapsed={collapsed}
        badge={badge}
      />
      {showPages ? (
        <ul className="my-1 ml-6 flex flex-col border-l border-sidebar-border">
          {section.pages.map((page) => {
            const isPage =
              pathname === page.path || pathname.startsWith(`${page.path}/`);
            return (
              <li key={page.path}>
                <Link
                  to={page.path}
                  aria-current={isPage ? "page" : undefined}
                  className={cn(
                    "-ml-px flex h-8 items-center border-l-2 pl-3 text-sm no-underline",
                    isPage
                      ? "border-sidebar-primary font-medium text-sidebar-accent-foreground"
                      : "border-transparent text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {translate(page.labelKey, { smart_count: page.smartCount })}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

/** How many clients wait for an answer, next to Chats. */
const WaitingBadge = () => {
  const { total = 0 } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
      filter: { "waiting_since@not.is": null },
    },
    { refetchInterval: WAITING_REFRESH_MS },
  );
  if (total === 0) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-sidebar-primary px-1.5 text-center text-xs font-semibold text-sidebar-primary-foreground">
      {total}
    </span>
  );
};

const MenuLink = ({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: NavSection["icon"];
  label: string;
}) => {
  const userMenuContext = useUserMenu();
  return (
    <DropdownMenuItem
      onClick={userMenuContext?.onClose}
      render={<Link to={to} className="flex items-center gap-2" />}
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  );
};

const UsersMenu = () => {
  const translate = useTranslate();
  return (
    <MenuLink
      to="/sales"
      icon={Users}
      label={translate("resources.sales.name", { smart_count: 2 })}
    />
  );
};

const ProfileMenu = () => {
  const translate = useTranslate();
  return (
    <MenuLink
      to="/profile"
      icon={User}
      label={translate("crm.profile.title")}
    />
  );
};

const SettingsMenu = () => {
  const translate = useTranslate();
  return (
    <MenuLink
      to="/settings"
      icon={Settings}
      label={translate("crm.settings.title")}
    />
  );
};

const ImportFromJsonMenuItem = () => {
  const translate = useTranslate();
  return (
    <MenuLink
      to={ImportPage.path}
      icon={Import}
      label={translate("crm.header.import_data")}
    />
  );
};

const ChangelogMenuItem = () => {
  const translate = useTranslate();
  return (
    <MenuLink
      to={ChangelogPage.path}
      icon={FileText}
      label={translate("crm.changelog.title")}
    />
  );
};
