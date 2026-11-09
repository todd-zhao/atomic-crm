import {
  address,
  company,
  datatype,
  internet,
  lorem,
  phone,
  random,
} from "faker/locale/en_US";

import { randomDate } from "./utils";
import {
  defaultChannelTypes,
  defaultCompanyCustomerCategories,
  defaultCompanySectors,
  defaultHotelServices,
  defaultHotelTypes,
} from "../../../root/defaultConfiguration";
import type { Company, RAFile } from "../../../types";
import type { Db } from "./types";

const sizes = [1, 10, 50, 250, 500];

const regex = /\W+/;

/** Sectors a channel (OTA, travel agency, ...) can belong to. */
const channelSectors = defaultCompanySectors.filter(
  (sector) =>
    sector.value !== "hotel" &&
    sector.value !== "hotel-group" &&
    sector.value !== "hospitality-management",
);

export const generateCompanies = (db: Db, size = 55): Required<Company>[] => {
  const companies = Array.from(Array(size).keys()).map((id) => {
    const name = company.companyName();
    // Roughly 6 hotels for 4 channels, so both directories have demo records.
    const isChannel = id % 5 >= 3;
    const company_kind = isChannel ? "channel" : "hotel";
    // A hotel group is part of the hotel directory but has no hotel property
    // fields: it is the parent company of some hotels.
    const isHotelGroup = !isChannel && id % 7 === 0;
    const sector = isChannel
      ? random.arrayElement(channelSectors).value
      : isHotelGroup
        ? random.arrayElement(["hotel-group", "hospitality-management"])
        : "hotel";
    const isHotelProperty = company_kind === "hotel" && !isHotelGroup;
    return {
      id,
      name: name,
      logo: {
        title: lorem.text(1),
        src: `https://marmelab.com/react-admin-crm/logos/${id}.png`,
      } as RAFile,
      company_kind,
      channel_type: isChannel
        ? random.arrayElement(defaultChannelTypes).value
        : null,
      sector,
      // KARE only classifies hotel customers
      customer_category: isHotelProperty
        ? random.arrayElement(defaultCompanyCustomerCategories).value
        : null,
      parent_company_id: null,
      size: random.arrayElement(sizes) as 1 | 10 | 50 | 250 | 500,
      linkedin_url: `https://www.linkedin.com/company/${name
        .toLowerCase()
        .replace(regex, "_")}`,
      website: internet.url(),
      phone_number: phone.phoneNumber(),
      address: address.streetAddress(),
      zipcode: address.zipCode(),
      city: address.city(),
      state_abbr: address.stateAbbr(),
      nb_contacts: 0,
      nb_deals: 0,
      // at least 1/3rd of companies for Jane Doe
      sales_id: datatype.number(2) === 0 ? 0 : random.arrayElement(db.sales).id,
      created_at: randomDate().toISOString(),
      description: lorem.paragraph(),
      revenue: random.arrayElement(["$1M", "$10M", "$100M", "$1B"]),
      tax_identifier: random.alphaNumeric(10),
      country: random.arrayElement(["USA", "France", "UK"]),
      context_links: [],
      // Hotel-specific custom fields only make sense for hotel properties
      hotel_type: isHotelProperty
        ? random.arrayElement(defaultHotelTypes).value
        : null,
      rooms: isHotelProperty ? datatype.number({ min: 30, max: 800 }) : null,
      opening_year: isHotelProperty
        ? datatype.number({ min: 1950, max: 2026 })
        : null,
      hotel_services: isHotelProperty
        ? random
            .arrayElements(
              defaultHotelServices,
              random.arrayElement([1, 2, 2, 3]),
            )
            .map((service) => service.value)
        : null,
      average_room_rate: isHotelProperty
        ? datatype.number({ min: 200, max: 3000 })
        : null,
    };
  });
  linkHotelsToGroups(companies);
  return companies;
};

/**
 * Point every third hotel at a group company of the demo data, so the demo shows
 * the related-company reference instead of leaving it empty. Channels never have
 * a parent company.
 */
const linkHotelsToGroups = (companies: Required<Company>[]) => {
  const groups = companies.filter(
    (company) =>
      company.company_kind === "hotel" &&
      (company.sector === "hotel-group" ||
        company.sector === "hospitality-management"),
  );
  if (!groups.length) return;
  companies.forEach((hotel, index) => {
    if (
      hotel.company_kind === "hotel" &&
      hotel.sector === "hotel" &&
      index % 3 === 0
    ) {
      hotel.parent_company_id = random.arrayElement(groups).id;
    }
  });
};
