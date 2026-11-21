import { Building2 } from "lucide-react";
import { CreateButton } from "@/components/admin/create-button";
import { useTranslate } from "ra-core";

import { DataImportButton } from "../dataImport/DataImportButton";
import useAppBarHeight from "../misc/useAppBarHeight";

export const CompanyEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const translate = useTranslate();
  return (
    <div
      className="flex flex-col justify-center items-center gap-6"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-accent text-primary">
        <Building2 className="size-8" aria-hidden />
      </span>
      <div className="flex flex-col gap-0 items-center">
        <h6 className="text-lg font-bold">
          {translate("resources.companies.empty.title", {
            _: "No companies found",
          })}
        </h6>
        <p className="text-sm text-center text-muted-foreground mb-4">
          {translate("resources.companies.empty.description", {
            _: "It seems your company list is empty.",
          })}
        </p>
      </div>
      <div className="flex space-x-2">
        <CreateButton label="resources.companies.action.create" />
        <DataImportButton resource="companies" />
      </div>
    </div>
  );
};
