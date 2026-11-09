import { defineExtension } from "@earendil-works/pi-durable";
import { SECTIONS } from "../prompt";
import { READ_TOOLS } from "./tools-read";
import { WRITE_TOOLS } from "./tools-write";

/** Everything the CRM assistant exposes to the model. */
export const CrmAssistantExtension = defineExtension({
  name: "crm-assistant",
  tools: [...READ_TOOLS, ...WRITE_TOOLS],
  sections: SECTIONS,
});
