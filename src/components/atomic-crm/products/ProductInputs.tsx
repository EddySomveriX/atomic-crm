import { minValue, maxValue, required, useTranslate } from "ra-core";
import { useWatch } from "react-hook-form";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextArrayInput } from "@/components/admin/text-array-input";
import { TextInput } from "@/components/admin/text-input";

import { MoneyInput } from "../money/MoneyInput";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { PRODUCT_KINDS, UNIT_CODES } from "./productOptions";
import { useTaxRates } from "./useStockData";

/** Fields of a product: kind, name, codes, unit, price and VAT rate. */
export const ProductInputs = ({ isEdit = false }: { isEdit?: boolean }) => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
  const taxRates = useTaxRates();
  const kind = useWatch({ name: "kind" });

  return (
    <div className="flex flex-col gap-4 p-1">
      <RadioButtonGroupInput
        source="kind"
        choices={PRODUCT_KINDS.map((kind) => ({
          id: kind,
          name: translate(`crm.products.kinds.${kind}`),
        }))}
        row
        helperText={false}
      />
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput
        source="category"
        helperText={translate("crm.pricing.category_hint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput source="sku" helperText={false} />
        <SelectInput
          source="unit_code"
          choices={UNIT_CODES.map((code) => ({
            id: code,
            name: translate(`crm.units.${code}`),
          }))}
          validate={required()}
          helperText={false}
        />
        <MoneyInput source="price" currency={currency} helperText={false} />
        <SelectInput
          source="vat_rate_code"
          choices={taxRates.map((rate) => ({
            id: rate.code,
            name: `${Number(rate.rate)}%`,
          }))}
          emptyText={translate("crm.products.no_vat")}
          helperText={false}
        />
      </div>
      {kind === "service" ? <BookingInputs /> : null}
      <TextArrayInput
        source="barcodes"
        helperText={translate("crm.products.barcodes_hint")}
      />
      <TextInput source="description" multiline helperText={false} />
      <BooleanInput source="show_online" helperText={false} />
      {kind === "service" ? (
        <BooleanInput
          source="is_addon"
          helperText={translate("crm.pricing.addon_hint")}
        />
      ) : null}
      {isEdit ? <BooleanInput source="archived" helperText={false} /> : null}
    </div>
  );
};

/** A service with a duration can be booked; the pause keeps time after it. */
const BookingInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          source="duration_minutes"
          step={5}
          validate={[minValue(5), maxValue(720)]}
          helperText={false}
        />
        <NumberInput
          source="buffer_minutes"
          step={5}
          validate={[minValue(0), maxValue(240)]}
          helperText={false}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {translate("crm.booking.duration_hint")}
      </p>
    </div>
  );
};
