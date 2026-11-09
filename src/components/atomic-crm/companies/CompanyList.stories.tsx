import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { StoryWrapper, buildCompany } from "@/test/StoryWrapper";

import { CompanyList } from "./CompanyList";

const meta = {
  title: "Atomic CRM/Companies/Hotel List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const hotel = buildCompany({
  id: 1,
  name: "Waldorf Shanghai",
  nb_contacts: 0,
  nb_deals: 0,
  sector: "hotel",
});

const channel = buildCompany({
  id: 2,
  name: "Ctrip",
  channel_type: "ota",
  company_kind: "channel",
  nb_contacts: 0,
  nb_deals: 0,
  sector: "travel",
});

export const HotelsOnly = () => (
  <StoryWrapper data={{ companies: [hotel, channel] }}>
    <ResourceContextProvider value="companies">
      <CompanyList />
    </ResourceContextProvider>
  </StoryWrapper>
);
