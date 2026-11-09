import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  RecordContextProvider,
  required,
  useDelete,
  useGetList,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
  type Identifier,
  type RaRecord,
  type SortPayload,
} from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { EditSheet } from "../misc/EditSheet";
import { CreateSheet } from "../misc/CreateSheet";
import { contactOptionText } from "../misc/ContactOption";
import { getSaleName } from "../misc/displayName";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, DealContact, Sale } from "../types";
import { formatDealDate, getNextIndex } from "./dealUtils";

/* -------------------------------------------------------------------------- */
/* Generic section                                                            */
/* -------------------------------------------------------------------------- */

const DEAL_ROLES = [
  "decision_maker",
  "influencer",
  "user",
  "gatekeeper",
] as const;
const INFLUENCE_LEVELS = ["high", "medium", "low"] as const;

type DealChildSectionProps = {
  resource: string;
  title: string;
  addLabel: string;
  emptyLabel: string;
  sort?: SortPayload;
  defaultValues?: Record<string, unknown>;
  renderRow: (record: RaRecord) => ReactNode;
  children: ReactNode;
};

/**
 * One editable list of deal children (stakeholders, pains, milestones,
 * meetings). Create and edit forms reuse the admin kit's `CreateSheet` and
 * `EditSheet`, so every change goes through `dataProvider.create/update/delete`
 * and the deal page is refreshed afterwards.
 */
const DealChildSection = ({
  resource,
  title,
  addLabel,
  emptyLabel,
  sort,
  defaultValues,
  renderRow,
  children,
}: DealChildSectionProps) => {
  const deal = useRecordContext<Deal>();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<Identifier | null>(null);

  const { data, isPending, refetch } = useGetList<RaRecord>(
    resource,
    {
      filter: { deal_id: deal?.id },
      sort: sort ?? { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    },
    { enabled: Boolean(deal?.id) },
  );

  const [deleteOne] = useDelete();

  const handleChanged = () => {
    refetch();
    refresh();
  };

  const handleDelete = (record: RaRecord) => {
    deleteOne(
      resource,
      { id: record.id, previousData: record },
      {
        mutationMode: "pessimistic",
        onSuccess: () => {
          notify("ra.notification.deleted", {
            type: "info",
            messageArgs: { smart_count: 1 },
          });
          handleChanged();
        },
        onError: () => {
          notify("ra.notification.http_error", { type: "error" });
        },
      },
    );
  };

  if (!deal) return null;

  return (
    <section className="space-y-2" data-testid={`deal-children-${resource}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-3.5" />
          {addLabel}
        </Button>
      </div>

      {isPending ? (
        <Spinner size="small" />
      ) : !data?.length ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((record) => (
            <li
              key={record.id}
              className="flex items-start gap-2 px-3 py-2"
              data-testid={`deal-child-${resource}-${record.id}`}
            >
              <RecordContextProvider value={record}>
                <div className="min-w-0 flex-1">{renderRow(record)}</div>
              </RecordContextProvider>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={translate("ra.action.edit")}
                  title={translate("ra.action.edit")}
                  onClick={() => setEditingId(record.id)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  aria-label={translate("ra.action.delete")}
                  title={translate("ra.action.delete")}
                  onClick={() => handleDelete(record)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateSheet
        resource={resource}
        title={<span className="text-xl font-semibold">{addLabel}</span>}
        redirect={false}
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultValues={{
          deal_id: deal.id,
          index: getNextIndex((data ?? []) as Array<{ index?: number | null }>),
          ...defaultValues,
        }}
        mutationOptions={{
          onSuccess: () => {
            setCreateOpen(false);
            handleChanged();
          },
        }}
      >
        {children}
      </CreateSheet>

      {editingId !== null && (
        <EditSheet
          key={String(editingId)}
          resource={resource}
          id={editingId}
          title={<span className="text-xl font-semibold">{title}</span>}
          redirect={false}
          open={editingId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
          mutationOptions={{
            onSuccess: () => {
              setEditingId(null);
              handleChanged();
            },
          }}
        >
          {children}
        </EditSheet>
      )}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

const AttendeeNames = ({ getLabel }: { getLabel: (record: any) => string }) => {
  const { data } = useListContext();
  if (!data?.length) return null;
  return <>{data.map((record) => getLabel(record)).join(", ")}</>;
};

const StakeholderRow = ({ record }: { record: DealContact }) => {
  const translate = useTranslate();
  const { contactAttitudes } = useConfigurationContext();
  const attitude = contactAttitudes.find(
    (option) => option.value === record.attitude,
  );
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ReferenceField source="contact_id" reference="contacts" link="show" />
        {record.role && (
          <Badge variant="outline">
            {translate(`resources.deals.roles.${record.role}`, {
              _: record.role,
            })}
          </Badge>
        )}
        {attitude && (
          <Badge variant="outline" className="gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: attitude.color }}
            />
            {attitude.label}
          </Badge>
        )}
        {record.influence && (
          <span className="text-xs text-muted-foreground">
            {translate("resources.deals.stakeholders.fields.influence")}:{" "}
            {translate(`resources.deals.influences.${record.influence}`, {
              _: record.influence,
            })}
          </span>
        )}
      </div>
      {record.pain && (
        <p className="text-xs break-words text-muted-foreground whitespace-pre-line">
          <span className="font-medium">
            {translate("resources.deals.stakeholders.fields.pain")}:
          </span>{" "}
          {record.pain}
        </p>
      )}
    </div>
  );
};

const PainRow = ({ record }: { record: RaRecord }) => {
  const translate = useTranslate();
  const fields: Array<[string, string]> = [
    ["cause", "resources.deals.pains.fields.cause"],
    ["duration", "resources.deals.pains.fields.duration"],
    ["quantified_loss", "resources.deals.pains.fields.quantified_loss"],
  ];
  return (
    <div className="space-y-1">
      {record.symptom && (
        <p className="text-sm font-medium break-words whitespace-pre-line">
          {record.symptom}
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {fields.map(([field, label]) =>
          record[field] ? (
            <span key={field}>
              <span className="font-medium">{translate(label)}:</span>{" "}
              {record[field]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
};

const MilestoneRow = ({ record }: { record: RaRecord }) => (
  <div className="flex flex-wrap items-baseline gap-2 text-sm">
    <span className="break-words whitespace-pre-line">{record.event}</span>
    {record.date && (
      <span className="text-xs text-muted-foreground">
        {formatDealDate(record.date)}
      </span>
    )}
  </div>
);

const MeetingRow = ({ record }: { record: RaRecord }) => {
  const translate = useTranslate();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {record.meeting_date && (
          <span className="text-sm font-medium text-foreground">
            {formatDealDate(record.meeting_date)}
          </span>
        )}
        {record.customer_attendee_ids?.length ? (
          <span>
            <span className="font-medium">
              {translate(
                "resources.deals.meetings.fields.customer_attendee_ids",
              )}
              :
            </span>{" "}
            <ReferenceArrayField
              source="customer_attendee_ids"
              reference="contacts"
            >
              <AttendeeNames getLabel={getContactAttendeeLabel} />
            </ReferenceArrayField>
          </span>
        ) : null}
        {record.our_attendee_ids?.length ? (
          <span>
            <span className="font-medium">
              {translate("resources.deals.meetings.fields.our_attendee_ids")}:
            </span>{" "}
            <ReferenceArrayField source="our_attendee_ids" reference="sales">
              <AttendeeNames getLabel={getSaleAttendeeLabel} />
            </ReferenceArrayField>
          </span>
        ) : null}
      </div>
      {record.content && (
        <p className="text-sm break-words text-muted-foreground whitespace-pre-line">
          {record.content}
        </p>
      )}
      {record.next_steps && (
        <p className="text-xs break-words whitespace-pre-line">
          <span className="font-medium">
            {translate("resources.deals.meetings.fields.next_steps")}:
          </span>{" "}
          {record.next_steps}
        </p>
      )}
    </div>
  );
};

const getContactAttendeeLabel = (record: any) =>
  record.name ||
  [record.first_name, record.last_name].filter(Boolean).join(" ");

const getSaleAttendeeLabel = (record: Sale) => getSaleName(record);

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export const DealStakeholders = () => {
  const translate = useTranslate();
  const { contactAttitudes } = useConfigurationContext();
  const roleChoices = DEAL_ROLES.map((value) => ({
    id: value,
    name: translate(`resources.deals.roles.${value}`),
  }));
  const influenceChoices = INFLUENCE_LEVELS.map((value) => ({
    id: value,
    name: translate(`resources.deals.influences.${value}`),
  }));
  return (
    <DealChildSection
      resource="deal_contacts"
      title={translate("resources.deals.stakeholders.title")}
      addLabel={translate("resources.deals.stakeholders.add")}
      emptyLabel={translate("resources.deals.stakeholders.empty")}
      renderRow={(record) => <StakeholderRow record={record as DealContact} />}
    >
      <ReferenceInput source="contact_id" reference="contacts">
        <AutocompleteInput
          label="resources.deals.stakeholders.fields.contact_id"
          optionText={contactOptionText}
          helperText={false}
          validate={required()}
          modal
        />
      </ReferenceInput>
      <SelectInput
        source="role"
        label="resources.deals.stakeholders.fields.role"
        choices={roleChoices}
        optionText="name"
        optionValue="id"
        helperText={false}
      />
      <SelectInput
        source="attitude"
        label="resources.deals.stakeholders.fields.attitude"
        choices={contactAttitudes.map((attitude) => ({
          id: attitude.value,
          name: attitude.label,
        }))}
        optionText="name"
        optionValue="id"
        helperText={false}
      />
      <SelectInput
        source="influence"
        label="resources.deals.stakeholders.fields.influence"
        choices={influenceChoices}
        optionText="name"
        optionValue="id"
        helperText={false}
      />
      <TextInput
        source="pain"
        label="resources.deals.stakeholders.fields.pain"
        multiline
        rows={2}
        helperText={false}
      />
    </DealChildSection>
  );
};

export const DealPains = () => {
  const translate = useTranslate();
  return (
    <DealChildSection
      resource="deal_pains"
      title={translate("resources.deals.pains.title")}
      addLabel={translate("resources.deals.pains.add")}
      emptyLabel={translate("resources.deals.pains.empty")}
      renderRow={(record) => <PainRow record={record} />}
    >
      <TextInput
        source="symptom"
        label="resources.deals.pains.fields.symptom"
        multiline
        rows={2}
        helperText={false}
      />
      <TextInput
        source="cause"
        label="resources.deals.pains.fields.cause"
        multiline
        rows={2}
        helperText={false}
      />
      <TextInput
        source="duration"
        label="resources.deals.pains.fields.duration"
        helperText={false}
      />
      <TextInput
        source="quantified_loss"
        label="resources.deals.pains.fields.quantified_loss"
        multiline
        rows={2}
        helperText={false}
      />
    </DealChildSection>
  );
};

export const DealMilestones = () => {
  const translate = useTranslate();
  return (
    <DealChildSection
      resource="deal_milestones"
      title={translate("resources.deals.milestones.title")}
      addLabel={translate("resources.deals.milestones.add")}
      emptyLabel={translate("resources.deals.milestones.empty")}
      sort={{ field: "date", order: "ASC" }}
      renderRow={(record) => <MilestoneRow record={record} />}
    >
      <TextInput
        source="event"
        label="resources.deals.milestones.fields.event"
        helperText={false}
      />
      <DateInput
        source="date"
        label="resources.deals.milestones.fields.date"
        helperText={false}
      />
    </DealChildSection>
  );
};

export const DealMeetings = () => {
  const translate = useTranslate();
  return (
    <DealChildSection
      resource="deal_meetings"
      title={translate("resources.deals.meetings.title")}
      addLabel={translate("resources.deals.meetings.add")}
      emptyLabel={translate("resources.deals.meetings.empty")}
      sort={{ field: "meeting_date", order: "DESC" }}
      renderRow={(record) => <MeetingRow record={record} />}
    >
      <DateInput
        source="meeting_date"
        label="resources.deals.meetings.fields.meeting_date"
        helperText={false}
      />
      <ReferenceArrayInput source="customer_attendee_ids" reference="contacts">
        <AutocompleteArrayInput
          label="resources.deals.meetings.fields.customer_attendee_ids"
          optionText={contactOptionText}
          helperText={false}
        />
      </ReferenceArrayInput>
      <ReferenceArrayInput source="our_attendee_ids" reference="sales">
        <AutocompleteArrayInput
          label="resources.deals.meetings.fields.our_attendee_ids"
          optionText={(record: Sale) => getSaleName(record)}
          helperText={false}
        />
      </ReferenceArrayInput>
      <TextInput
        source="content"
        label="resources.deals.meetings.fields.content"
        multiline
        rows={2}
        helperText={false}
      />
      <TextInput
        source="next_steps"
        label="resources.deals.meetings.fields.next_steps"
        multiline
        rows={2}
        helperText={false}
      />
    </DealChildSection>
  );
};
