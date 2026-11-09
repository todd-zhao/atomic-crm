import { describe, it, expect } from "vitest";
import type { RaRecord } from "ra-core";
import { validateItemsInUse } from "./SettingsPage";

describe("validateItemsInUse", () => {
  // Deals now carry both a methodology stage and a board status.
  const deals: RaRecord[] = [
    { id: 1, stage: "contact", status: "won" },
    { id: 2, stage: "pain", status: "exited" },
    { id: 3, stage: "contact", status: "active" },
  ];

  it("returns undefined when items is undefined", () => {
    expect(validateItemsInUse(undefined, deals, "stage", "stages")).toBe(
      undefined,
    );
  });

  it("returns undefined when all in-use values are present", () => {
    const items = [
      { value: "contact", label: "Contact" },
      { value: "pain", label: "Pain identification" },
    ];
    expect(validateItemsInUse(items, deals, "stage", "stages")).toBe(undefined);
  });

  it("returns an error when an in-use value is removed", () => {
    const items = [{ value: "contact", label: "Contact" }];
    expect(validateItemsInUse(items, deals, "stage", "stages")).toBe(
      "Cannot remove stages that are still used by deals: pain",
    );
  });

  it("lists all missing in-use values", () => {
    const items = [{ value: "contact", label: "Contact" }];
    const result = validateItemsInUse(items, deals, "status", "statuses");
    expect(result).toContain("won");
    expect(result).toContain("exited");
    expect(result).toContain("active");
  });

  it("returns an error when there are duplicate slugs", () => {
    const items = [
      { value: "contact", label: "Contact" },
      { value: "contact", label: "Contact again" },
      { value: "pain", label: "Pain identification" },
    ];
    expect(validateItemsInUse(items, deals, "stage", "stages")).toBe(
      "Duplicate stages: contact",
    );
  });

  it("detects duplicates via slug fallback when value is empty", () => {
    const items = [
      { value: "", label: "Contact" },
      { value: "contact", label: "Contact again" },
      { value: "pain", label: "Pain identification" },
    ];
    expect(validateItemsInUse(items, deals, "stage", "stages")).toBe(
      "Duplicate stages: contact",
    );
  });

  it("returns 'Validating…' when deals have not loaded yet", () => {
    const items = [{ value: "contact", label: "Contact" }];
    expect(validateItemsInUse(items, undefined, "stage", "stages")).toBe(
      "Validating…",
    );
  });

  it("ignores deals with a falsy value for the checked field", () => {
    const dealsWithEmpty: RaRecord[] = [
      { id: 1, stage: "contact", deal_type: null },
      { id: 2, stage: "contact", deal_type: undefined },
    ];
    const items = [{ value: "other", label: "Other" }];
    expect(
      validateItemsInUse(items, dealsWithEmpty, "deal_type", "deal types"),
    ).toBe(undefined);
  });

  it("works with a scalar field such as the deal status", () => {
    const items = [{ value: "won", label: "Won" }];
    expect(validateItemsInUse(items, deals, "status", "statuses")).toContain(
      "exited",
    );
  });
});
