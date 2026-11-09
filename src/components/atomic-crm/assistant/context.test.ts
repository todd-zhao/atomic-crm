import { describe, expect, it } from "vitest";

import { getAssistantContext } from "./context";

describe("getAssistantContext", () => {
  it("detects the dashboard", () => {
    expect(getAssistantContext("/")).toEqual({
      page: "dashboard",
      entityId: null,
    });
  });

  it("detects a contact detail page", () => {
    expect(getAssistantContext("/contacts/9/show")).toEqual({
      page: "contact",
      entityId: 9,
    });
  });

  it("detects a company detail page", () => {
    expect(getAssistantContext("/companies/12")).toEqual({
      page: "company",
      entityId: 12,
    });
  });

  it("detects a deal detail page", () => {
    expect(getAssistantContext("/deals/4/show")).toEqual({
      page: "deal",
      entityId: 4,
    });
  });

  it("detects list pages", () => {
    expect(getAssistantContext("/contacts")).toEqual({
      page: "contacts",
      entityId: null,
    });
    expect(getAssistantContext("/deals")).toEqual({
      page: "deals",
      entityId: null,
    });
    expect(getAssistantContext("/tasks")).toEqual({
      page: "tasks",
      entityId: null,
    });
  });

  it("detects the settings page", () => {
    expect(getAssistantContext("/settings")).toEqual({
      page: "settings",
      entityId: null,
    });
  });

  it("falls back to `other`", () => {
    expect(getAssistantContext("/assistant")).toEqual({
      page: "other",
      entityId: null,
    });
    expect(getAssistantContext("/profile")).toEqual({
      page: "other",
      entityId: null,
    });
  });
});
