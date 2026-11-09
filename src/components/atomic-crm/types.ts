import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  /** Full display name (Chinese convention), preferred over first/last name. */
  name?: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  secondary_emails?: string[];
  password?: string;
  /** Full display name (Chinese convention), preferred over first/last name. */
  name?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
};

export type Sale = {
  /** Full display name (Chinese convention), preferred over first/last name. */
  name?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  secondary_emails?: string[];

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  /** 'hotel' = direct customer directory, 'channel' = channel/partner directory. */
  company_kind: string;
  /** OTA / travel agency / meeting agency / corporate agreement / other (channels only). */
  channel_type?: string | null;
  sector: string;
  /** KARE customer classification: keep / acquire / recover / expand. */
  customer_category?: string | null;
  /** Parent company (group HQ) when this hotel belongs to a group. */
  parent_company_id?: Identifier | null;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
  /** Hotel-specific custom fields. */
  hotel_type?: string | null;
  rooms?: number | null;
  opening_year?: number | null;
  hotel_services?: string[] | null;
  average_room_rate?: number | null;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type WorkExperience = {
  start_year?: number | null;
  end_year?: number | null;
  company?: string;
  title?: string;
};

export type Education = {
  start_year?: number | null;
  end_year?: number | null;
  school?: string;
  major?: string;
  degree?: string;
};

export type Contact = {
  /** Full display name (Chinese convention), preferred over first/last name. */
  name?: string;
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  /** The contact who referred this contact (null = no referrer). */
  referrer_contact_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  wechat_id?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: number[];
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
  /** Channel or customer. */
  contact_type?: string | null;
  birthday?: string | null;
  /** DISC communication style: D / I / S / C. */
  communication_style?: string | null;
  /** Sandler attitude: reject / cold / neutral / friendly / support. */
  attitude?: string | null;
  /** Years at the current company. */
  tenure_years?: number | null;
  social_organization?: string | null;
  work_experience?: WorkExperience[] | null;
  education?: Education[] | null;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id?: Identifier | null;
  /** Sandler methodology phase: contact / pain / budget / decision / solution / after_sale. */
  stage: string;
  /** Board status: potential / active / won / exited. */
  status: string;
  /** new purchase / renewal / upsell. */
  deal_type?: string | null;
  /** direct = direct hotel customer, channel = sourced through a channel company. */
  source_type: string;
  /** Channel company the opportunity came from (source_type = channel). */
  channel_id?: Identifier | null;
  description?: string;
  decision_process?: string | null;
  budget?: number | null;
  final_amount?: number | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date?: string | null;
  sales_id?: Identifier;
  competitor_id?: Identifier | null;
  attachments?: AttachmentNote[];
  index: number;
  /** True while the deal has no sales owner: it sits in the public pool. */
  is_unassigned?: boolean;
} & Pick<RaRecord, "id">;

/** Stakeholder of a deal with their Sandler role, attitude and personal pain. */
export type DealContact = {
  deal_id: Identifier;
  contact_id: Identifier;
  role?: string | null;
  attitude?: string | null;
  influence?: string | null;
  pain?: string | null;
  index?: number | null;
} & Pick<RaRecord, "id">;

export type DealPain = {
  deal_id: Identifier;
  symptom?: string | null;
  cause?: string | null;
  duration?: string | null;
  quantified_loss?: string | null;
  index?: number | null;
} & Pick<RaRecord, "id">;

export type DealMilestone = {
  deal_id: Identifier;
  event?: string | null;
  date?: string | null;
  index?: number | null;
} & Pick<RaRecord, "id">;

export type DealMeeting = {
  deal_id: Identifier;
  meeting_date?: string | null;
  customer_attendee_ids?: Identifier[] | null;
  our_attendee_ids?: Identifier[] | null;
  content?: string | null;
  next_steps?: string | null;
  created_at?: string;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type Competitor = {
  name: string;
  brand_influence?: string | null;
  market_price?: string | null;
  advantages?: string | null;
  weaknesses?: string | null;
  created_at?: string;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id?: Identifier | null;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export interface DealStage extends LabeledValue {
  /** Color used to badge active deals on the board. */
  color?: string;
}

export interface DealStatus extends LabeledValue {
  color: string;
}

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export type SearchResourceName =
  "companies" | "contacts" | "deals" | "tasks" | "contact_notes" | "deal_notes";

export type SearchResult = {
  resource: SearchResourceName;
  record_id: Identifier;
  title: string | null;
  subtitle: string | null;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  date: string | null;
  /** The searched fields, to show and highlight where the query matched. */
  content: string | null;
};
