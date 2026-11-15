import { Create } from "@/components/admin/create";
import { Edit } from "@/components/admin/edit";
import { SimpleForm } from "@/components/admin/simple-form";

import { ProductInputs } from "./ProductInputs";
import type { Product } from "./types";

/** Only a service has a duration: switching to goods clears it. */
const withBookingFields = (product: Partial<Product>) =>
  product.kind === "service"
    ? product
    : { ...product, duration_minutes: null, buffer_minutes: 0 };

export const ProductCreate = () => (
  <Create redirect="show" transform={withBookingFields}>
    <SimpleForm
      defaultValues={{
        kind: "goods",
        unit_code: "pcs",
        barcodes: [],
        buffer_minutes: 0,
      }}
    >
      <ProductInputs />
    </SimpleForm>
  </Create>
);

export const ProductEdit = () => (
  <Edit
    redirect="show"
    mutationMode="pessimistic"
    // quantity and average_cost come from products_summary, not the table
    transform={({ quantity: _q, average_cost: _c, ...product }: Product) =>
      withBookingFields(product)
    }
  >
    <SimpleForm>
      <ProductInputs isEdit />
    </SimpleForm>
  </Edit>
);
