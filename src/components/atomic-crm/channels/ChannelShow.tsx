import { CompanyShow } from "../companies/CompanyShow";

/**
 * Channel detail page. Both company directories share the `companies` resource
 * and the same show UI, which branches on `company_kind` to display channel
 * details instead of hotel fields.
 */
export const ChannelShow = () => <CompanyShow resource="companies" />;

ChannelShow.path = "/channels/:id/show";
/** The show page also hosts the activity / contacts / deals tabs. */
ChannelShow.tabPath = "/channels/:id/show/:tab?";
