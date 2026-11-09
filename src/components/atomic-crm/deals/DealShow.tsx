import { useMutation } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import {
  InfiniteListBase,
  ShowBase,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealStageBadge, DealStatusBadge } from "./DealBadges";
import { DealFiles } from "./DealFiles";
import {
  DealMeetings,
  DealMilestones,
  DealPains,
  DealStakeholders,
} from "./DealSubtables";
import {
  findDealSource,
  findDealStage,
  findDealStatus,
  findDealType,
  formatDealAmount,
  formatDealDate,
} from "./dealUtils";

export const DealShow = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const handleClose = () => {
    redirect("list", "deals");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? (
          <ShowBase id={id}>
            <DealShowContent />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const DealShowContent = () => {
  const translate = useTranslate();
  const { dealSources, dealStages, dealStatuses, dealTypes, currency } =
    useConfigurationContext();
  const record = useRecordContext<Deal>();
  if (!record) return null;

  const status = findDealStatus(dealStatuses, record.status);
  const stage = findDealStage(dealStages, record.stage);
  const dealType = findDealType(dealTypes, record.deal_type);
  const dealSource = findDealSource(dealSources, record.source_type);
  const isUnassigned = record.sales_id == null;
  const closingDate = record.expected_closing_date;
  const isClosingDatePast = closingDate
    ? new Date(closingDate) < new Date()
    : false;

  return (
    <div className="space-y-2">
      {record.archived_at ? <ArchivedTitle /> : null}
      <div className="flex-1">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <ReferenceField
              source="company_id"
              reference="companies"
              link="show"
            >
              <CompanyAvatar />
            </ReferenceField>
            <h2 className="text-xl font-semibold truncate">{record.name}</h2>
          </div>
          <div className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}>
            {record.archived_at ? (
              <>
                <UnarchiveButton record={record} />
                <DeleteButton />
              </>
            ) : (
              <>
                {isUnassigned ? <ClaimButton record={record} /> : null}
                <ArchiveButton record={record} />
                <EditButton />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4 m-4">
          <InfoField label={translate("crm.pool.owner")}>
            {isUnassigned ? (
              <Badge variant="secondary">
                {translate("crm.pool.unassigned")}
              </Badge>
            ) : (
              <ReferenceField source="sales_id" reference="sales" link="show" />
            )}
          </InfoField>
          <InfoField label={translate("resources.deals.fields.status")}>
            <DealStatusBadge status={status} />
          </InfoField>
          <InfoField label={translate("resources.deals.fields.stage")}>
            <DealStageBadge stage={stage} />
          </InfoField>
          <InfoField label={translate("resources.deals.fields.deal_type")}>
            {dealType?.label ?? record.deal_type ?? "—"}
          </InfoField>
          <InfoField label={translate("resources.deals.fields.source_type")}>
            {dealSource?.label ?? record.source_type ?? "—"}
          </InfoField>
          {record.source_type === "channel" ? (
            <InfoField label={translate("resources.deals.fields.channel_id")}>
              {record.channel_id != null ? (
                <ReferenceField
                  source="channel_id"
                  reference="companies"
                  link="show"
                />
              ) : (
                "—"
              )}
            </InfoField>
          ) : null}
          <InfoField label={translate("resources.deals.fields.budget")}>
            {record.budget != null
              ? formatDealAmount(record.budget, currency)
              : "—"}
          </InfoField>
          <InfoField label={translate("resources.deals.fields.final_amount")}>
            {record.final_amount != null
              ? formatDealAmount(record.final_amount, currency)
              : "—"}
          </InfoField>
          <InfoField
            label={translate("resources.deals.fields.expected_closing_date")}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {closingDate
                  ? formatDealDate(closingDate)
                  : translate("resources.deals.invalid_date")}
              </span>
              {isClosingDatePast ? (
                <Badge variant="destructive">
                  {translate("crm.common.past")}
                </Badge>
              ) : null}
            </div>
          </InfoField>
          <InfoField label={translate("resources.deals.fields.competitor_id")}>
            {record.competitor_id != null ? (
              <ReferenceField
                source="competitor_id"
                reference="competitors"
                link="show"
              />
            ) : (
              "—"
            )}
          </InfoField>
        </div>

        {record.decision_process && (
          <div className="m-4">
            <FieldLabel>
              {translate("resources.deals.fields.decision_process")}
            </FieldLabel>
            <p className="text-sm leading-6 break-words whitespace-pre-line">
              {record.decision_process}
            </p>
          </div>
        )}

        {record.description && (
          <div className="m-4 whitespace-pre-line">
            <FieldLabel>
              {translate("resources.deals.fields.description")}
            </FieldLabel>
            <p className="text-sm leading-6 break-words">
              {record.description}
            </p>
          </div>
        )}

        <div className="m-4 space-y-5">
          <Separator />
          <DealStakeholders />
          <Separator />
          <DealPains />
          <Separator />
          <DealMilestones />
          <Separator />
          <DealMeetings />
          <Separator />
          <DealFiles />
          <Separator />
          <InfiniteListBase
            resource="deal_notes"
            filter={{ deal_id: record.id }}
            sort={{ field: "date", order: "DESC" }}
            perPage={25}
            disableSyncWithLocation
            storeKey={false}
            empty={<NoteCreate reference={"deals"} />}
          >
            <NotesIterator reference="deals" />
          </InfiniteListBase>
        </div>
      </div>
    </div>
  );
};

const InfoField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <FieldLabel>{label}</FieldLabel>
    <div className="text-sm">{children}</div>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs text-muted-foreground tracking-wide">
    {children}
  </span>
);

/**
 * Claim an unassigned deal from its detail page: the current user becomes the
 * sales owner and the deal leaves the lead pool.
 */
const ClaimButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [claiming, setClaiming] = useState(false);

  const handleClick = async () => {
    if (identity?.id == null || claiming) return;
    setClaiming(true);
    try {
      await dataProvider.update("deals", {
        id: record.id,
        data: { sales_id: identity.id },
        previousData: record,
      });
      notify("crm.pool.claimed", { type: "info", undoable: false });
      refresh();
    } catch {
      notify("crm.pool.claim_error", { type: "error" });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      className="flex items-center gap-2 h-9"
      disabled={claiming}
      data-testid="deal-claim-button"
    >
      {claiming ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {translate("crm.pool.claim")}
    </Button>
  );
};

const ArchivedTitle = () => {
  const translate = useTranslate();
  return (
    <div className="bg-orange-500 px-6 py-4">
      <h3 className="text-lg font-bold text-white">
        {translate("resources.deals.archived.title")}
      </h3>
    </div>
  );
};

const ArchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [update] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          redirect("list", "deals");
          notify("resources.deals.archived.success", {
            type: "info",
            undoable: false,
          });
          refresh();
        },
        onError: () => {
          notify("resources.deals.archived.error", {
            type: "error",
          });
        },
      },
    );
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <Archive className="w-4 h-4" />
      {translate("resources.deals.archived.action")}
    </Button>
  );
};

const UnarchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: () => {
      redirect("list", "deals");
      notify("resources.deals.unarchived.success", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("resources.deals.unarchived.error", {
        type: "error",
      });
    },
  });

  const handleClick = () => {
    mutate();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <ArchiveRestore className="w-4 h-4" />
      {translate("resources.deals.unarchived.action")}
    </Button>
  );
};
