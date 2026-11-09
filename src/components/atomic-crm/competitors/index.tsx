import type { Competitor } from "../types";
import { CompetitorCreate } from "./CompetitorCreate";
import { CompetitorEdit } from "./CompetitorEdit";
import { CompetitorList } from "./CompetitorList";
import { CompetitorShow } from "./CompetitorShow";

export default {
  list: CompetitorList,
  create: CompetitorCreate,
  edit: CompetitorEdit,
  show: CompetitorShow,
  recordRepresentation: (record: Competitor) => record.name,
};
