import { EditBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAside } from "../companies/CompanyAside";
import { FormToolbar } from "../layout/FormToolbar";
import { ChannelInputs } from "./ChannelInputs";

/**
 * Edits a channel. The `companies` resource is shared with the hotel directory,
 * so the route is a CustomRoute and redirects back to the channel show page.
 */
export const ChannelEdit = () => (
  <EditBase
    resource="companies"
    redirect={(_resource, id) => `/channels/${id}/show`}
    transform={(values) => {
      // add https:// before website if not present
      if (values.website && !values.website.startsWith("http")) {
        values.website = `https://${values.website}`;
      }
      // Pages own their directory: editing here keeps the record a channel.
      values.company_kind = "channel";
      return values;
    }}
  >
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4 pb-2">
        <Card>
          <CardContent>
            <ChannelInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <CompanyAside link="show" />
    </div>
  </EditBase>
);

ChannelEdit.path = "/channels/:id";
