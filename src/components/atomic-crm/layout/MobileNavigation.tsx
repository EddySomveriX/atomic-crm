import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Ellipsis,
  ListTodo,
  Plus,
  Settings,
  StickyNote,
  UserPlus,
} from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation, useMatch } from "react-router";
import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
import {
  sectionOfPath,
  visibleSections,
  type NavSection,
} from "../modules/modules";
import { useModules } from "../modules/useModules";
import { useState } from "react";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

/**
 * Pages of each section that exist on a phone; sections without one (sales)
 * stay on the computer.
 */
const MOBILE_PATHS: Record<string, string> = {
  today: "/",
  chats: "/chats",
  booking: "/calendar",
  counterparties: "/contacts",
  stock: "/products",
  tasks: "/tasks",
  analytics: "/analytics",
  pricing: "/prices",
  documents: "/documents",
  marketing: "/marketing",
};

/**
 * The bottom bar of a phone: Today, the first two sections of the modules the
 * business uses, the "+" in the middle, and "More" with the other sections
 * and the settings.
 */
export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();
  const { modules } = useModules();

  const sections = visibleSections(modules).filter(
    (section) => MOBILE_PATHS[section.key] != null,
  );
  const [today, ...others] = sections;
  const pinned = others.slice(0, 2);
  const more = others.slice(2);
  const current = sectionOfPath(location.pathname);
  const isSettings = matchPath("/settings/*", location.pathname) != null;

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  const button = (section: NavSection) => (
    <NavigationButton
      key={section.key}
      href={MOBILE_PATHS[section.key]}
      Icon={section.icon}
      label={translate(section.labelKey)}
      isActive={current?.key === section.key}
    />
  );

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        // We use box-sizing: border-box, so the height contains the padding.
        // To actually increase the padding, we need to increase the height as well
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center">
        {today ? button(today) : null}
        {pinned[0] ? button(pinned[0]) : null}
        <CreateButton />
        {pinned[1] ? button(pinned[1]) : null}
        <MoreButton
          sections={more}
          isActive={
            isSettings || more.some((section) => section.key === current?.key)
          }
        />
      </div>
    </nav>
  );
};

/** "More": the other sections and the settings. */
const MoreButton = ({
  sections,
  isActive,
}: {
  sections: NavSection[];
  isActive: boolean;
}) => {
  const translate = useTranslate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
              isActive ? null : "text-muted-foreground",
            )}
          />
        }
      >
        <Ellipsis className="size-6" />
        <span className="text-[0.6rem] font-medium">
          {translate("crm.nav.more")}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {sections.map((section) => (
          <DropdownMenuItem
            key={section.key}
            className="h-12 gap-3 px-4 text-base"
            render={<Link to={MOBILE_PATHS[section.key]} />}
          >
            <section.icon className="size-5" />
            {translate(section.labelKey)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          className="h-12 gap-3 px-4 text-base"
          render={<Link to="/settings" />}
        >
          <Settings className="size-5" />
          {translate("crm.settings.title")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Link
    to={href}
    className={cn(
      buttonVariants({ variant: "ghost" }),
      "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Icon className="size-6" />
    <span className="text-[0.6rem] font-medium">{label}</span>
  </Link>
);

const CreateButton = () => {
  const translate = useTranslate();
  const { isOn } = useModules();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  return (
    <>
      <ContactCreateSheet
        open={contactCreateOpen}
        onOpenChange={setContactCreateOpen}
      />
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={contact_id}
      />
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        contact_id={contact_id}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="default"
              size="icon"
              className="h-16 w-16 rounded-full -mt-3"
              aria-label={translate("ra.action.create")}
            />
          }
        >
          <Plus className="size-10" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem
            className="h-12 gap-3 px-4 text-base"
            onClick={() => {
              setContactCreateOpen(true);
            }}
          >
            <UserPlus className="size-5" />
            {translate("resources.contacts.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 gap-3 px-4 text-base"
            onClick={() => {
              setNoteCreateOpen(true);
            }}
          >
            <StickyNote className="size-5" />
            {translate("resources.notes.forcedCaseName")}
          </DropdownMenuItem>
          {isOn("tasks") ? (
            <DropdownMenuItem
              className="h-12 gap-3 px-4 text-base"
              onClick={() => {
                setTaskCreateOpen(true);
              }}
            >
              <ListTodo className="size-5" />
              {translate("resources.tasks.forcedCaseName")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
