import type { ConfigurationContextValue } from "./ConfigurationContext";
// Import the logos as module assets so Vite resolves their URL relative to the
// JS chunk (import.meta.url), not the current route. A plain "./logos/..." path
// breaks on nested routes like /oauth/consent and under a deployment sub-path.
import darkModeLogo from "./logos/logo_atomic_crm_dark.svg";
import lightModeLogo from "./logos/logo_atomic_crm_light.svg";
import { getInitialLocale } from "../providers/commons/i18nProvider";

export const defaultDarkModeLogo = darkModeLogo;
export const defaultLightModeLogo = lightModeLogo;

export const defaultCurrency = "CNY";

export const defaultTitle = "Atomic CRM";

// Enum labels are stored in the configuration (and can be overridden through
// the store or the backend), so they are resolved once at startup from the
// detected browser locale: Chinese browsers get Chinese labels, everyone else
// keeps the English defaults.
const isChinese = getInitialLocale() === "zh";
const label = (english: string, chinese: string) =>
  isChinese ? chinese : english;

export const defaultCompanySectors = [
  {
    value: "hotel",
    label: label("Hotel", "酒店"),
  },
  {
    value: "hotel-group",
    label: label("Hotel group", "酒店集团"),
  },
  {
    value: "hospitality-management",
    label: label("Hospitality management", "酒店管理公司"),
  },
  {
    value: "real-estate",
    label: label("Real Estate", "房地产"),
  },
  {
    value: "travel",
    label: label("Travel", "旅游"),
  },
  {
    value: "catering",
    label: label("Catering", "餐饮"),
  },
  {
    value: "conference",
    label: label("Conference & Exhibition", "会展"),
  },
  {
    value: "information-technology",
    label: label("Information Technology", "信息科技"),
  },
  {
    value: "manufacturing",
    label: label("Manufacturing", "制造业"),
  },
  {
    value: "finance",
    label: label("Finance", "金融"),
  },
  {
    value: "other",
    label: label("Other", "其他"),
  },
];

/** Two separate company directories: direct hotel customers vs channel/other companies. */
export const defaultCompanyKinds = [
  {
    value: "hotel",
    label: label("Hotel (direct customer)", "酒店（直接客户）"),
  },
  {
    value: "channel",
    label: label("Channel (other company)", "渠道（其他公司）"),
  },
];

/** Sub-types shown in the channel directory only. */
export const defaultChannelTypes = [
  { value: "ota", label: label("OTA", "OTA 平台") },
  { value: "travel_agency", label: label("Travel agency", "旅行社") },
  {
    value: "meeting_agency",
    label: label("Meeting & event agency", "会务/会议代理"),
  },
  {
    value: "corporate_agreement",
    label: label("Corporate agreement / TMC", "企业协议/差旅管理"),
  },
  { value: "other", label: label("Other", "其他") },
];

/** Where the opportunity came from. Direct is the default. */
export const defaultDealSources = [
  { value: "direct", label: label("Direct customer", "直客") },
  { value: "channel", label: label("Channel", "渠道") },
];

/** KARE customer classification from the CRM data model. */
export const defaultCompanyCustomerCategories = [
  { value: "keep", label: label("K - Keep", "K 保持") },
  { value: "acquire", label: label("A - Acquire", "A 获取") },
  { value: "recover", label: label("R - Recover", "R 重获") },
  { value: "expand", label: label("E - Expand", "E 拓展") },
];

export const defaultHotelTypes = [
  {
    value: "international_chain",
    label: label("International chain", "国际联号"),
  },
  { value: "national_chain", label: label("National chain", "全国连锁") },
  { value: "local_chain", label: label("Local chain", "地方连锁") },
  { value: "independent", label: label("Independent hotel", "单体酒店") },
  { value: "homestay", label: label("Homestay", "民宿") },
];

export const defaultHotelServices = [
  { value: "rooms", label: label("Rooms", "客房") },
  { value: "restaurant", label: label("Food & Beverage", "餐饮") },
  { value: "meeting", label: label("Meetings & Events", "会务") },
  { value: "entertainment", label: label("Entertainment", "娱乐") },
];

/** Sandler methodology phases, shown as colored badges on active deals. */
export const defaultDealStages = [
  {
    value: "contact",
    label: label("Contact", "接触"),
    color: "#7dbde8",
  },
  {
    value: "pain",
    label: label("Pain identification", "甄别痛点"),
    color: "#e88b7d",
  },
  {
    value: "budget",
    label: label("Budget discussion", "探讨预算"),
    color: "#e8cb7d",
  },
  {
    value: "decision",
    label: label("Decision process", "澄清决策链"),
    color: "#b39ddb",
  },
  {
    value: "solution",
    label: label("Solution", "解决方案"),
    color: "#a4e87d",
  },
  {
    value: "after_sale",
    label: label("After-sales follow-up", "后售跟进"),
    color: "#9e9e9e",
  },
];

/** Board columns. The pipeline is driven by status, not by stage. */
export const defaultDealStatuses = [
  { value: "potential", label: label("Potential", "潜在"), color: "#7dbde8" },
  { value: "active", label: label("Active", "活跃"), color: "#e8cb7d" },
  { value: "won", label: label("Won", "成交"), color: "#a4e87d" },
  { value: "exited", label: label("Exited", "退出"), color: "#e88b7d" },
];

export const defaultDealTypes = [
  { value: "new", label: label("New purchase", "新购") },
  { value: "renewal", label: label("Renewal", "续约") },
  { value: "upsell", label: label("Upsell", "增购") },
];

export const defaultContactTypes = [
  { value: "channel", label: label("Channel", "渠道") },
  { value: "customer", label: label("Customer", "客户") },
];

/** Sandler buyer attitudes. Also used to color the contact status dot. */
export const defaultContactAttitudes = [
  { value: "reject", label: label("Reject", "排斥"), color: "#d9534f" },
  { value: "cold", label: label("Cold", "冷淡"), color: "#7dbde8" },
  { value: "neutral", label: label("Neutral", "中立"), color: "#9e9e9e" },
  { value: "friendly", label: label("Friendly", "友好"), color: "#e8cb7d" },
  { value: "support", label: label("Support", "支持"), color: "#a4e87d" },
];

export const defaultCommunicationStyles = [
  { value: "D", label: label("D - Dominance", "D 支配型") },
  { value: "I", label: label("I - Influence", "I 影响型") },
  { value: "S", label: label("S - Steadiness", "S 稳健型") },
  { value: "C", label: label("C - Compliance", "C 谨慎型") },
];

export const defaultSocialOrganizations = [
  {
    value: "hotel_association",
    label: label("Hotel association", "酒店行业协会"),
  },
  {
    value: "tourism_association",
    label: label("Tourism association", "旅游饭店业协会"),
  },
  { value: "alumni", label: label("Alumni association", "校友会") },
  {
    value: "entrepreneur_club",
    label: label("Entrepreneur club", "企业家俱乐部"),
  },
  { value: "other", label: label("Other", "其他") },
];

export const defaultEducationDegrees = [
  { value: "high_school", label: label("High school", "高中") },
  { value: "college", label: label("College", "大专") },
  { value: "bachelor", label: label("Bachelor", "本科") },
  { value: "master", label: label("Master", "硕士") },
  { value: "phd", label: label("PhD", "博士") },
  { value: "other", label: label("Other", "其他") },
];

export const defaultNoteStatuses = [
  { value: "cold", label: label("Cold", "冷淡"), color: "#7dbde8" },
  { value: "warm", label: label("Warm", "温和"), color: "#e8cb7d" },
  { value: "hot", label: label("Hot", "热门"), color: "#e88b7d" },
  {
    value: "in-contract",
    label: label("In Contract", "签约中"),
    color: "#a4e87d",
  },
];

export const defaultTaskTypes = [
  { value: "none", label: label("None", "无") },
  { value: "email", label: label("Email", "邮件") },
  { value: "demo", label: label("Demo", "演示") },
  { value: "lunch", label: label("Lunch", "午餐") },
  { value: "meeting", label: label("Meeting", "会议") },
  { value: "follow-up", label: label("Follow-up", "跟进") },
  { value: "thank-you", label: label("Thank you", "致谢") },
  { value: "ship", label: label("Ship", "交付") },
  { value: "call", label: label("Call", "电话") },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  companyKinds: defaultCompanyKinds,
  channelTypes: defaultChannelTypes,
  companyCustomerCategories: defaultCompanyCustomerCategories,
  contactTypes: defaultContactTypes,
  contactAttitudes: defaultContactAttitudes,
  communicationStyles: defaultCommunicationStyles,
  currency: defaultCurrency,
  dealStatuses: defaultDealStatuses,
  dealStages: defaultDealStages,
  dealTypes: defaultDealTypes,
  dealSources: defaultDealSources,
  educationDegrees: defaultEducationDegrees,
  hotelServices: defaultHotelServices,
  hotelTypes: defaultHotelTypes,
  noteStatuses: defaultNoteStatuses,
  socialOrganizations: defaultSocialOrganizations,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
