import { useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { useCalmMode } from "./calmMode";

export const CalmModeSwitch = () => {
  const translate = useTranslate();
  const [isCalm, setCalm] = useCalmMode();
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {translate("crm.calm_mode.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.calm_mode.hint")}
          </p>
        </div>
        <Switch
          checked={isCalm}
          aria-label={translate("crm.calm_mode.title")}
          onCheckedChange={(checked) => setCalm(checked)}
        />
      </CardContent>
    </Card>
  );
};
