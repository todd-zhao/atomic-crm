import type { Meta } from "@storybook/react-vite";

import { StoryWrapper, buildCompany } from "@/test/StoryWrapper";

import { ChannelList } from "./ChannelList";

const meta = {
  title: "Atomic CRM/Channels/Channel List",
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
  city: "Shanghai",
  company_kind: "channel",
  nb_contacts: 1,
  nb_deals: 2,
  sector: "travel",
});

export const ChannelsOnly = () => (
  <StoryWrapper data={{ companies: [hotel, channel] }}>
    <ChannelList />
  </StoryWrapper>
);
