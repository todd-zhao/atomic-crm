import { useCreate, useGetIdentity, useNotify, useTranslate } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import type { Company } from "../types";

export const AutocompleteCompanyInput = ({
  validate,
  label,
  modal,
  clearable,
}: Pick<InputProps, "validate" | "label"> &
  Pick<PopoverPrimitive.Root.Props, "modal"> & {
    /** Show a button to unset the company, for optional references. */
    clearable?: boolean;
  }) => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const translate = useTranslate();
  // The companies resource holds both directories: mark channels so users can
  // tell them apart from hotels in a company picker.
  const optionText = (choice: Company) =>
    choice.company_kind === "channel"
      ? `${choice.name} (${translate("crm.channels.title")})`
      : choice.name;
  const handleCreateCompany = async (name?: string) => {
    if (!name) return;
    try {
      const newCompany = await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newCompany;
    } catch {
      notify("resources.companies.autocomplete.create_error", {
        type: "error",
        messageArgs: {
          _: "An error occurred while creating the company",
        },
      });
    }
  };
  const isMobile = useIsMobile();

  return (
    <AutocompleteInput
      label={label}
      optionText={optionText}
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel="resources.companies.autocomplete.create_item"
      createLabel="resources.companies.autocomplete.create_label"
      validate={validate}
      modal={modal ?? isMobile}
      clearable={clearable}
    />
  );
};
