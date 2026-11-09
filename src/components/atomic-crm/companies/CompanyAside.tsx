import type { ReactNode } from "react";
import { Eye, Globe, Linkedin, Pencil, Phone } from "lucide-react";
import {
  LinkBase,
  useGetIdentity,
  useGetOne,
  useLocaleState,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteButton } from "@/components/admin/delete-button";
import { TextField } from "@/components/admin/text-field";
import { UrlField } from "@/components/admin/url-field";
import { SelectField } from "@/components/admin/select-field";

import { formatLocalizedDate } from "../misc/RelativeDate";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { companyEditPath, companyShowPath } from "./companyKindPaths";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";
import { useGetSalesName } from "../sales/useGetSalesName";

interface CompanyAsideProps {
  link?: "edit" | "show";
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  if (!record) return null;
  const isChannel = record.company_kind === "channel";

  return (
    <div className="hidden sm:block w-92 min-w-92 space-y-4">
      <div className="flex flex-row space-x-1">
        <DirectoryButton
          to={
            link === "edit" ? companyEditPath(record) : companyShowPath(record)
          }
          label={translate(
            link === "edit"
              ? isChannel
                ? "crm.channels.edit"
                : "resources.companies.action.edit"
              : "resources.companies.action.show",
          )}
          icon={link === "edit" ? <Pencil /> : <Eye />}
        />
      </div>

      <CompanyInfo record={record} />

      {isChannel ? (
        <>
          <ChannelInfo record={record} />
          <AddressInfo record={record} />
          <ChannelBackgroundInfo record={record} />
        </>
      ) : (
        <>
          <AddressInfo record={record} />
          <ContextInfo record={record} />
          <AdditionalInfo record={record} />
        </>
      )}

      {link !== "edit" && (
        <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
          <DeleteButton
            className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            size="sm"
          />
        </div>
      )}
    </div>
  );
};

/**
 * Edit/show button that follows the record's directory, since channels have
 * their own `/channels` route while both kinds share the `companies` resource.
 */
const DirectoryButton = ({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) => (
  <LinkBase className={cn(buttonVariants({ variant: "outline" }))} to={to}>
    {icon}
    {label}
  </LinkBase>
);

export const CompanyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (!record.website && !record.linkedin_url && !record.phone_number) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.contact")}
    >
      {record.website && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Globe className="w-4 h-4" />
          <UrlField
            source="website"
            target="_blank"
            rel="noopener"
            content={record.website
              .replace("http://", "")
              .replace("https://", "")}
          />
        </div>
      )}
      {record.linkedin_url && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Linkedin className="w-4 h-4" />
          <a
            className="underline hover:no-underline"
            href={record.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            title={record.linkedin_url}
          >
            LinkedIn
          </a>
        </div>
      )}
      {record.phone_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <TextField source="phone_number" />
        </div>
      )}
    </AsideSection>
  );
};

export const ContextInfo = ({ record }: { record: Company }) => {
  const { companyCustomerCategories } = useConfigurationContext();
  const translate = useTranslate();
  if (!record.revenue && !record.id) {
    return null;
  }

  const customerCategory = companyCustomerCategories.find(
    (category) => category.value === record.customer_category,
  );
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.context")}
    >
      {customerCategory && (
        <span>
          {translate("resources.companies.fields.customer_category")}:{" "}
          {customerCategory.label}
        </span>
      )}
      {record.parent_company_id != null && (
        <span>
          {translate("resources.companies.fields.parent_company_id")}:{" "}
          <RelatedCompanyLink id={record.parent_company_id} />
        </span>
      )}
      {record.size && (
        <span>
          {translate("resources.companies.fields.size")}:{" "}
          <SelectField source="size" choices={translatedSizes} />
        </span>
      )}
      {record.revenue && (
        <span>
          {translate("resources.companies.fields.revenue")}:{" "}
          <TextField source="revenue" />
        </span>
      )}
      {record.tax_identifier && (
        <span>
          {translate("resources.companies.fields.tax_identifier", {})}
          : <TextField source="tax_identifier" />
        </span>
      )}
    </AsideSection>
  );
};

/**
 * Link to the group HQ a hotel belongs to. The referenced company is not in the
 * record context, so it is fetched separately; the link only shows once its name
 * is known.
 */
const RelatedCompanyLink = ({ id }: { id: Company["id"] }) => {
  const { data: parentCompany } = useGetOne<Company>("companies", { id });
  if (!parentCompany) return null;
  return (
    <Link
      to={`/companies/${parentCompany.id}/show`}
      className="underline hover:no-underline"
    >
      {parentCompany.name}
    </Link>
  );
};

export const AddressInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.address &&
    !record.city &&
    !record.zipcode &&
    !record.state_abbr
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.address")}
      noGap
    >
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="state_abbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

/**
 * Channel directory details: the company kind, its channel sub-type and sector.
 * Hotels show their KARE classification and hotel fields instead.
 */
export const ChannelInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const { channelTypes, companyKinds, companySectors } =
    useConfigurationContext();
  const kind = companyKinds.find(
    (choice) => choice.value === record.company_kind,
  );
  const channelType = channelTypes.find(
    (choice) => choice.value === record.channel_type,
  );
  const sector = companySectors.find(
    (choice) => choice.value === record.sector,
  );
  if (!kind && !channelType && !sector) return null;

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.channel", {
        _: "Channel details",
      })}
    >
      {kind && (
        <span>
          {translate("resources.companies.fields.company_kind")}: {kind.label}
        </span>
      )}
      {channelType && (
        <span>
          {translate("resources.companies.fields.channel_type")}:{" "}
          {channelType.label}
        </span>
      )}
      {sector && (
        <span>
          {translate("resources.companies.fields.sector")}: {sector.label}
        </span>
      )}
    </AsideSection>
  );
};

/**
 * Channel directory backdrop: background info, owner and creation date. Channels
 * have no KARE classification, hotel fields or parent group.
 */
export const ChannelBackgroundInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const isCurrentUser = record.sales_id === identity?.id;
  const salesName = useGetSalesName(record.sales_id, {
    enabled: !isCurrentUser,
  });
  if (!record.description && record.sales_id == null && !record.created_at) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.additional_info")}
    >
      {record.description && (
        <p className="text-sm  mb-1">{record.description}</p>
      )}
      {record.sales_id != null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          {translate(
            isCurrentUser
              ? "resources.companies.followed_by_you"
              : "resources.companies.followed_by",
            { name: salesName },
          )}
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          {translate("resources.companies.added_on", {
            date: formatLocalizedDate(record.created_at, locale),
          })}{" "}
        </p>
      )}
    </AsideSection>
  );
};

export const AdditionalInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const { currency, hotelTypes, hotelServices } = useConfigurationContext();
  const isCurrentUser = record.sales_id === identity?.id;
  const salesName = useGetSalesName(record.sales_id, {
    enabled: !isCurrentUser,
  });

  const hotelType = hotelTypes.find((type) => type.value === record.hotel_type);
  const services = (record.hotel_services ?? []).map(
    (service) =>
      hotelServices.find((choice) => choice.value === service)?.label ??
      service,
  );
  const hasHotelInfo =
    !!hotelType ||
    record.rooms != null ||
    record.opening_year != null ||
    services.length > 0 ||
    record.average_room_rate != null;

  if (
    !hasHotelInfo &&
    !record.created_at &&
    !record.sales_id &&
    !record.description &&
    !record.context_links
  ) {
    return null;
  }
  const getBaseURL = (url: string) => {
    const urlObject = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObject.hostname;
  };

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.hotel")}
    >
      {hotelType && (
        <span>
          {translate("resources.companies.fields.hotel_type")}:{" "}
          {hotelType.label}
        </span>
      )}
      {record.rooms != null && (
        <span>
          {translate("resources.companies.fields.rooms")}:{" "}
          {record.rooms.toLocaleString(locale)}
        </span>
      )}
      {record.opening_year != null && (
        <span>
          {translate("resources.companies.fields.opening_year")}:{" "}
          {record.opening_year}
        </span>
      )}
      {services.length > 0 && (
        <span>
          {translate("resources.companies.fields.hotel_services")}:{" "}
          {services.join(" / ")}
        </span>
      )}
      {record.average_room_rate != null && (
        <span>
          {translate("resources.companies.fields.average_room_rate")}:{" "}
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(record.average_room_rate)}
        </span>
      )}
      {record.description && (
        <p className="text-sm  mb-1">{record.description}</p>
      )}
      {record.context_links && (
        <div className="flex flex-col">
          {record.context_links.map((link, index) =>
            link ? (
              <a
                key={index}
                className="text-sm underline hover:no-underline mb-1"
                href={link.startsWith("http") ? link : `https://${link}`}
                target="_blank"
                rel="noopener noreferrer"
                title={link}
              >
                {getBaseURL(link)}
              </a>
            ) : null,
          )}
        </div>
      )}
      {record.sales_id !== null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          {translate(
            isCurrentUser
              ? "resources.companies.followed_by_you"
              : "resources.companies.followed_by",
            { name: salesName },
          )}
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          {translate("resources.companies.added_on", {
            date: formatLocalizedDate(record.created_at, locale),
          })}{" "}
        </p>
      )}
    </AsideSection>
  );
};
