import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import DealList from "./DealList";

import {
  StoryWrapper,
  buildCompany,
  buildDeal,
  buildSale,
} from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Deals/Deal List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const dataForAccountManagerFilter = {
  companies: [buildCompany()],
  deals: [
    buildDeal({
      id: 1,
      name: "Jane deal",
      sales_id: 0,
      status: "potential",
      stage: "contact",
      deal_type: "new",
      budget: 1000,
      is_unassigned: false,
    }),
    buildDeal({
      id: 2,
      index: 1,
      name: "Marie deal",
      sales_id: 1,
      status: "active",
      stage: "pain",
      deal_type: "renewal",
      budget: 2000,
      is_unassigned: false,
    }),
  ],
  sales: [
    buildSale({ administrator: true, first_name: "Jane", id: 0 }),
    buildSale({
      administrator: false,
      email: "mariecurie@atomic.dev",
      first_name: "Marie",
      id: 1,
      last_name: "Curie",
      user_id: "1",
    }),
  ],
};

const dataForStatusBoard = {
  companies: [buildCompany()],
  deals: [
    buildDeal({
      id: 1,
      name: "Potential deal",
      status: "potential",
      stage: "budget",
      deal_type: "new",
      budget: 1000,
      is_unassigned: false,
    }),
    buildDeal({
      id: 2,
      index: 1,
      name: "Active deal",
      status: "active",
      stage: "pain",
      deal_type: "renewal",
      budget: 2000,
      is_unassigned: false,
    }),
    buildDeal({
      id: 3,
      index: 2,
      name: "Won deal",
      status: "won",
      stage: "after_sale",
      deal_type: "upsell",
      budget: 3000,
      final_amount: 2800,
      is_unassigned: false,
    }),
    buildDeal({
      id: 4,
      index: 3,
      name: "Exited deal",
      status: "exited",
      stage: "contact",
      deal_type: "new",
      budget: 0,
      is_unassigned: false,
    }),
    // Sits in the lead pool: must not appear on the board.
    buildDeal({
      id: 5,
      index: 4,
      name: "Pool deal",
      status: "potential",
      stage: "contact",
      deal_type: "new",
      budget: 5000,
      sales_id: undefined,
      is_unassigned: true,
    }),
  ],
};

export const AdminAccountManagerFilter = () => (
  <StoryWrapper data={dataForAccountManagerFilter}>
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const NonAdminAccountManagerFilter = () => (
  <StoryWrapper
    authProvider={{
      canAccess: async ({ resource }) => resource !== "sales",
    }}
    data={dataForAccountManagerFilter}
  >
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const StatusBoard = () => (
  <StoryWrapper data={dataForStatusBoard}>
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);
