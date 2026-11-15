import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

/** All open tasks of the team by due date (the "Справи" module). */
export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{translate("crm.nav.tasks")}</h1>
        <AddTask selectContact display="chip" />
      </div>
      <Card className="p-4">
        <TasksListContent />
      </Card>
    </div>
  );
};
