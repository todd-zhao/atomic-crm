import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { StoryWrapper, buildSale } from "@/test/StoryWrapper";

import { SalesList } from "./SalesList";

const meta = {
  title: "Atomic CRM/Sales/Sales List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

// A Chinese user: `name` (张伟) wins over the legacy first/last name.
const saleWithName = buildSale({
  administrator: false,
  email: "zhangwei@atomic.dev",
  first_name: "Wei",
  id: 1,
  last_name: "Zhang",
  name: "张伟",
  user_id: "1",
});

// An English user without `name`: the display falls back to "First Last".
const saleWithoutName = buildSale({
  administrator: true,
  email: "marie@atomic.dev",
  first_name: "Marie",
  id: 2,
  last_name: "Curie",
  user_id: "2",
});

export const WithAndWithoutName = () => (
  <StoryWrapper data={{ sales: [saleWithName, saleWithoutName] }}>
    <ResourceContextProvider value="sales">
      <SalesList />
    </ResourceContextProvider>
  </StoryWrapper>
);
