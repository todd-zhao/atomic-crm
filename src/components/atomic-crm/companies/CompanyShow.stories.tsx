import type { Meta } from "@storybook/react-vite";

import { StoryWrapper, buildCompany } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Companies/Company Show",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const group = buildCompany({
  id: 1,
  name: "Marriott Group",
  sector: "hotel-group",
  customer_category: "keep",
  nb_contacts: 0,
  nb_deals: 0,
});

const hotel = buildCompany({
  id: 2,
  name: "Waldorf Shanghai",
  sector: "hotel",
  customer_category: "keep",
  parent_company_id: 1,
  hotel_type: "international_chain",
  rooms: 260,
  opening_year: 2010,
  hotel_services: ["rooms", "restaurant", "meeting"],
  average_room_rate: 1800,
  nb_contacts: 0,
  nb_deals: 0,
});

const channel = buildCompany({
  id: 3,
  name: "Ctrip",
  company_kind: "channel",
  channel_type: "ota",
  sector: "travel",
  customer_category: null,
  parent_company_id: null,
  nb_contacts: 0,
  nb_deals: 0,
});

const Show = ({ id }: { id: number }) => (
  <StoryWrapper
    data={{ companies: [group, hotel, channel] }}
    initialEntries={[`/companies/${id}/show`]}
  >
    {null}
  </StoryWrapper>
);

export const HotelOfAGroup = () => <Show id={2} />;

export const GroupCompany = () => <Show id={1} />;

export const ChannelOfTheDirectory = () => <Show id={3} />;
