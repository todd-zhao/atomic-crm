import type { Meta } from "@storybook/react-vite";
import { RecordContextProvider } from "ra-core";

import { StoryWrapper, buildCompany } from "@/test/StoryWrapper";

import { CompanyCard } from "./CompanyCard";

const meta = {
  title: "Atomic CRM/Companies/Company Card",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const hotel = buildCompany({
  id: 1,
  name: "Waldorf Shanghai",
  sector: "hotel",
  customer_category: "keep",
  hotel_type: "international_chain",
  nb_contacts: 0,
  nb_deals: 0,
});

const groupCompany = buildCompany({
  id: 2,
  name: "Marriott Group",
  sector: "hotel-group",
  customer_category: "acquire",
  nb_contacts: 0,
  nb_deals: 0,
});

const Card = ({ record }: { record: typeof hotel }) => (
  <StoryWrapper>
    <RecordContextProvider value={record}>
      <CompanyCard />
    </RecordContextProvider>
  </StoryWrapper>
);

export const Hotel = () => <Card record={hotel} />;

export const GroupCompany = () => <Card record={groupCompany} />;
