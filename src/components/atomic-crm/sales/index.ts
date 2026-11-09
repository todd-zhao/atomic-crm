import { getSaleName } from "../misc/displayName";
import type { Sale } from "../types";
import { SalesCreate } from "./SalesCreate";
import { SalesEdit } from "./SalesEdit";
import { SalesList } from "./SalesList";

export default {
  list: SalesList,
  create: SalesCreate,
  edit: SalesEdit,
  recordRepresentation: (record: Sale) => getSaleName(record),
};
