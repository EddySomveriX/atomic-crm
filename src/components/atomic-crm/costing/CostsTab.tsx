import { useTranslate } from "ra-core";
import { useSearchParams } from "react-router";

import { CostSettingsCard } from "./CostSettingsCard";
import { CostTable } from "./CostTable";
import { OverheadCard } from "./OverheadCard";
import { useCostData } from "./useCostData";
import { LoadingRows } from "../misc/PageStates";

/**
 * The "Собівартість" tab of the price list: how costs are counted, the
 * expenses of a month, and the cost and profit of every service and goods.
 */
export const CostsTab = () => {
  const translate = useTranslate();
  const [searchParams] = useSearchParams();
  const { canRead, inputs, products, materials, items, isPending, error } =
    useCostData();

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("crm.costing.no_access")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {translate("crm.costing.failed")}
      </p>
    );
  }
  if (isPending || !inputs) return <LoadingRows />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {translate("crm.costing.intro")}
      </p>
      <CostTable
        inputs={inputs}
        products={products}
        materials={materials}
        items={items}
        openId={searchParams.get("product")}
      />
      <OverheadCard monthly={inputs.overhead_monthly} />
      <CostSettingsCard inputs={inputs} key={JSON.stringify(inputs.settings)} />
    </div>
  );
};
