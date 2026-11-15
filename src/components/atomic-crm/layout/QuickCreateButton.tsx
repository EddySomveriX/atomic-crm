import {
  Building2,
  CalendarPlus,
  Handshake,
  ListTodo,
  Plus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useModules } from "../modules/useModules";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

/**
 * The single "+" of the interface (TZ section 4.1): creates any object of
 * the modules the business uses. In the left menu it is the light button at
 * the top; collapsed, only the plus shows.
 */
export const QuickCreateButton = ({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) => {
  const translate = useTranslate();
  const { isOn } = useModules();
  const [taskOpen, setTaskOpen] = useState(false);
  const label = translate("crm.quick_create.label");

  return (
    <>
      <TaskCreateSheet open={taskOpen} onOpenChange={setTaskOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn("h-10 gap-1.5 rounded-full px-4", className)}
              aria-label={collapsed ? label : undefined}
            />
          }
        >
          <Plus className="size-5" />
          {collapsed ? null : <span>{label}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          {isOn("booking") ? (
            <DropdownMenuItem
              render={
                <Link to="/calendar" className="flex items-center gap-2" />
              }
            >
              <CalendarPlus />
              {translate("crm.quick_create.booking")}
            </DropdownMenuItem>
          ) : null}
          {isOn("sales") ? (
            <DropdownMenuItem
              render={
                <Link to="/deals/create" className="flex items-center gap-2" />
              }
            >
              <Handshake />
              {translate("crm.quick_create.deal")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            render={
              <Link to="/contacts/create" className="flex items-center gap-2" />
            }
          >
            <UserPlus />
            {translate("crm.quick_create.contact")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                to="/companies/create"
                className="flex items-center gap-2"
              />
            }
          >
            <Building2 />
            {translate("crm.quick_create.company")}
          </DropdownMenuItem>
          {isOn("tasks") ? (
            <DropdownMenuItem
              onClick={() => setTaskOpen(true)}
              className="flex items-center gap-2"
            >
              <ListTodo />
              {translate("crm.quick_create.task")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
