import { CreateBase, Form, useGetIdentity, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

import { ChannelInputs } from "./ChannelInputs";

/**
 * Creates a channel: a `companies` record flagged `company_kind = 'channel'`,
 * shown in the channel directory only.
 */
export const ChannelCreate = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();

  return (
    <CreateBase
      resource="companies"
      redirect={(_resource, id) => `/channels/${id}/show`}
      transform={(values) => {
        // add https:// before website if not present
        if (values.website && !values.website.startsWith("http")) {
          values.website = `https://${values.website}`;
        }
        // Pages own their directory: this form can only create channels.
        values.company_kind = "channel";
        return values;
      }}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{ channel_type: undefined, sales_id: identity?.id }}
          >
            <Card>
              <CardContent>
                <ChannelInputs />
                <div
                  role="toolbar"
                  className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
                >
                  <CancelButton />
                  <SaveButton
                    label={translate("crm.channels.create", {
                      _: "Create channel",
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};

ChannelCreate.path = "/channels/create";
