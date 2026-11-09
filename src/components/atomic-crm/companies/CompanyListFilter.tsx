import { Building, Building2, Hotel, Tag, Users } from "lucide-react";
import { FilterLiveForm, useGetIdentity, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { SearchInput } from "@/components/admin/search-input";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AccountManagerFilter } from "../sales/AccountManagerInput";
import { CompanyKindFilter } from "./CompanyKindFilter";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const { companyCustomerCategories, hotelTypes } = useConfigurationContext();
  const translate = useTranslate();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="w-52 min-w-52 flex flex-col gap-8">
      <FilterLiveForm>
        <SearchInput source="q" />
      </FilterLiveForm>

      <FilterCategory
        icon={<Building2 className="h-4 w-4" />}
        label="resources.companies.fields.company_kind"
      >
        <CompanyKindFilter activeKind="hotel" />
      </FilterCategory>

      <FilterCategory
        icon={<Tag className="h-4 w-4" />}
        label="resources.companies.fields.customer_category"
      >
        {companyCustomerCategories.map((category) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={category.label}
            key={category.value}
            value={{ customer_category: category.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Hotel className="h-4 w-4" />}
        label="resources.companies.fields.hotel_type"
      >
        {hotelTypes.map((hotelType) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={hotelType.label}
            key={hotelType.value}
            value={{ hotel_type: hotelType.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label="resources.companies.fields.size"
      >
        {translatedSizes.map((size) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="resources.companies.fields.sales_id"
      >
        <ToggleFilterButton
          className="w-full justify-between"
          label={translate("crm.common.me")}
          value={{ sales_id: identity?.id }}
        />
        <AccountManagerFilter className="w-full justify-between" />
      </FilterCategory>
    </div>
  );
};
