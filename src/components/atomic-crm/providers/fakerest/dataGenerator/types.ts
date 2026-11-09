import type {
  Company,
  Competitor,
  Contact,
  ContactNote,
  Deal,
  DealContact,
  DealMeeting,
  DealMilestone,
  DealNote,
  DealPain,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  competitors: Competitor[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_contacts: DealContact[];
  deal_meetings: DealMeeting[];
  deal_milestones: DealMilestone[];
  deal_notes: DealNote[];
  deal_pains: DealPain[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
