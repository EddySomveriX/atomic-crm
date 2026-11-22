import { Download, Loader2 } from "lucide-react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";
import { buildExportZip, exportFileName } from "./exportData";

const saveFile = (bytes: Uint8Array, fileName: string) => {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/zip" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Downloads every table of the business as one ZIP (owners only). */
export const ExportDataButton = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await dataProvider.exportBusinessData();
      const day = new Date().toLocaleDateString("sv-SE");
      saveFile(buildExportZip(data), exportFileName(day));
      notify("crm.subscription.export.done", { type: "success" });
    } catch (error: unknown) {
      console.error("export failed:", error);
      notify("crm.subscription.export.error", { type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting}>
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      {translate(
        isExporting
          ? "crm.subscription.export.working"
          : "crm.subscription.export.action",
      )}
    </Button>
  );
};
