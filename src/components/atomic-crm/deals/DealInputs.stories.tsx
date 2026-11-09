import type { Meta } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Form } from "ra-core";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { StoryWrapper, buildCompany } from "@/test/StoryWrapper";
import { DealInputs } from "./DealInputs";

const meta = {
  title: "Atomic CRM/Deals/DealInputs",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const defaultData = {
  companies: [
    buildCompany({ id: 1, name: "Smith Corp", company_kind: "hotel" }),
    buildCompany({ id: 2, name: "Globex Travel", company_kind: "channel" }),
  ],
};

export const CreateForm = ({
  children,
  data = defaultData,
}: {
  children?: ReactNode;
  data?: any;
}) => (
  <StoryWrapper data={data}>
    <Create resource="deals">
      <Form
        defaultValues={{
          index: 0,
          sales_id: 0,
          source_type: "direct",
          status: "potential",
          stage: "contact",
          deal_type: "new",
        }}
      >
        <DealInputs />
        <FormToolbar>
          <SaveButton />
        </FormToolbar>
      </Form>
    </Create>
    {children}
  </StoryWrapper>
);
