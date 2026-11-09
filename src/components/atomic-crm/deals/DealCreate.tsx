import { useQueryClient } from "@tanstack/react-query";
import {
  CreateBase,
  Form,
  useCreateContext,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useRedirect,
  type GetListResult,
} from "ra-core";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { FormToolbar } from "../layout/FormToolbar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { normalizeDealPayload, DEALS_POOL_PATH } from "./dealUtils";
import { DealInputs } from "./DealInputs";

export const DealCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { dealSources, dealStatuses, dealStages, dealTypes } =
    useConfigurationContext();
  const { data: allDeals } = useListContext<Deal>();

  const handleClose = () => {
    redirect("/deals");
  };

  const queryClient = useQueryClient();

  const onSuccess = async (deal: Deal) => {
    // A deal created without an owner belongs to the lead pool, not to the
    // board: send the user where the deal actually is.
    if (deal.sales_id == null || deal.is_unassigned) {
      redirect(DEALS_POOL_PATH);
      return;
    }
    if (!allDeals) {
      redirect("/deals");
      return;
    }
    // increase the index of all deals in the same status as the new deal
    // first, get the list of deals in the same status
    const deals = allDeals.filter(
      (d: Deal) => d.status === deal.status && d.id !== deal.id,
    );
    // update the actual deals in the database
    await Promise.all(
      deals.map(async (oldDeal) =>
        dataProvider.update("deals", {
          id: oldDeal.id,
          data: { index: oldDeal.index + 1 },
          previousData: oldDeal,
        }),
      ),
    );
    // refresh the list of deals in the cache as we used dataProvider.update(),
    // which does not update the cache
    const dealsById = deals.reduce(
      (acc, d) => ({
        ...acc,
        [d.id]: { ...d, index: d.index + 1 },
      }),
      {} as { [key: string]: Deal },
    );
    const now = Date.now();
    queryClient.setQueriesData<GetListResult | undefined>(
      { queryKey: ["deals", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((d: Deal) => dealsById[d.id] || d),
        };
      },
      { updatedAt: now },
    );
    redirect("/deals");
  };

  const { identity } = useGetIdentity();

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <CreateBase
          resource="deals"
          transform={normalizeDealPayload}
          mutationOptions={{ onSuccess }}
        >
          <CreateHeader />
          <Form
            defaultValues={{
              sales_id: identity?.id,
              index: 0,
              source_type: dealSources[0]?.value,
              status: dealStatuses[0]?.value,
              stage: dealStages[0]?.value,
              deal_type: dealTypes[0]?.value,
            }}
          >
            <DealInputs />
            <FormToolbar />
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};

const CreateHeader = () => {
  const { defaultTitle } = useCreateContext();
  return (
    <DialogTitle className="text-xl font-semibold">{defaultTitle}</DialogTitle>
  );
};
