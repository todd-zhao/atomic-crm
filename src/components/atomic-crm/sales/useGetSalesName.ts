import type { Identifier } from "ra-core";
import { useGetManyAggregate } from "ra-core";

import { getSaleName } from "../misc/displayName";

export const useGetSalesName = (
  id?: Identifier,
  options?: { enabled?: boolean },
) => {
  const enabled = options?.enabled ?? id != null;
  const { data, error } = useGetManyAggregate(
    "sales",
    { ids: id !== null ? [id] : undefined },
    { enabled },
  );

  return data && data[0] ? getSaleName(data[0]) : error ? "??" : "";
};
