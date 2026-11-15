import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";

import type { Business } from "../business/types";
import type { CrmDataProvider } from "../providers/types";
import type { ModuleKey } from "./modules";
import { ModulesPicker } from "./ModulesPicker";

/**
 * The modules of the current business in its settings. Each switch saves at
 * once, and the menu on the left changes with it.
 */
export const ModulesSettings = ({ business }: { business: Business }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [modules, setModules] = useState<ModuleKey[]>(business.modules);

  const save = useMutation({
    mutationFn: (next: ModuleKey[]) =>
      dataProvider.updateBusiness(business.id, { modules: next }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
    onError: () => {
      setModules(business.modules);
      notify("crm.modules.failed", { type: "error" });
    },
  });

  return (
    <section id="modules" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">
          {translate("crm.modules.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate("crm.modules.settings_hint")}
        </p>
      </div>
      <ModulesPicker
        value={modules}
        onChange={(next) => {
          setModules(next);
          save.mutate(next);
        }}
      />
    </section>
  );
};
