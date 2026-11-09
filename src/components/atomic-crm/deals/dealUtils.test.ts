import { commands } from "vitest/browser";

import {
  findDealLabel,
  findDealSource,
  findDealStage,
  findDealStatus,
  formatDealAmount,
  formatDealDate,
  formatDealStage,
  formatDealStatus,
  formatDealType,
  formatISODateString,
  getDealReferenceDate,
  getNextIndex,
  normalizeDealPayload,
} from "./dealUtils";

const config = {
  dealStages: [
    { value: "contact", label: "Contact" },
    { value: "pain", label: "Pain identification" },
  ],
  dealStatuses: [
    { value: "potential", label: "Potential", color: "#7dbde8" },
    { value: "active", label: "Active", color: "#e8cb7d" },
  ],
  dealTypes: [
    { value: "new", label: "New purchase" },
    { value: "renewal", label: "Renewal" },
  ],
};

describe("formatISODateString", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("formats a valid ISO date string correctly", () => {
    const isoDate = "2024-06-15";
    const formattedDate = formatISODateString(isoDate);
    expect(formattedDate).toBe("Jun 15, 2024");
  });

  it("should not shift the date regardless of timezone", async () => {
    // Uses CDP (Emulation.setTimezoneOverride) to actually change the browser's
    // timezone at runtime so we can catch regressions where someone replaces the
    // manual date-component parse with new Date(isoString), which would shift
    // dates in negative-offset timezones like America/New_York.
    const isoDate = "2024-06-15";
    await commands.setTimezone("America/New_York");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("Asia/Tokyo");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("UTC");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    await commands.setTimezone("Pacific/Auckland");
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
  });

  it("throw for an invalid date string", () => {
    const invalidDate = "invalid-date";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });

  it("throw for a date string with wrong format", () => {
    const invalidDate = "15-06-2024";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });
});

describe("deal label helpers", () => {
  it("keeps the legacy findDealLabel(choices, value) signature", () => {
    expect(findDealLabel(config.dealStages, "pain")).toBe(
      "Pain identification",
    );
    expect(findDealLabel(config.dealStages, "unknown")).toBeUndefined();
  });

  it("accepts the whole deal configuration", () => {
    expect(findDealLabel(config, "contact")).toBe("Contact");
  });

  it("resolves stage, status and type options", () => {
    expect(findDealStage(config.dealStages, "pain")?.label).toBe(
      "Pain identification",
    );
    expect(findDealStatus(config.dealStatuses, "active")?.color).toBe(
      "#e8cb7d",
    );
    expect(formatDealStage(config, "contact")).toBe("Contact");
    expect(formatDealStatus(config, "potential")).toBe("Potential");
    expect(formatDealType(config, "renewal")).toBe("Renewal");
  });

  it("falls back to the raw value for unknown configured values", () => {
    expect(formatDealStage(config, "custom")).toBe("custom");
    expect(formatDealType(config, null)).toBe("");
  });
});

describe("deal formatting helpers", () => {
  it("formats amounts as a compact currency", () => {
    const formatted = formatDealAmount(12000, "USD");
    expect(formatted).toContain("$");
    expect(formatted).toContain("12");
    expect(formatDealAmount(null, "USD")).toBe("");
  });

  it("formats dates without throwing on empty or invalid values", () => {
    expect(formatDealDate("2024-06-15")).toBe("Jun 15, 2024");
    expect(formatDealDate(null)).toBe("");
    expect(formatDealDate("")).toBe("");
  });

  it("shows a short closing date on the cards", () => {
    expect(
      getDealReferenceDate({
        expected_closing_date: "2026-09-30",
      } as never),
    ).toBe("9/30");
    expect(getDealReferenceDate({} as never)).toBe("");
  });
});

describe("getNextIndex", () => {
  it("returns 0 for an empty list", () => {
    expect(getNextIndex([])).toBe(0);
    expect(getNextIndex(undefined)).toBe(0);
  });

  it("appends below the highest index", () => {
    expect(getNextIndex([{ index: 0 }, { index: 4 }])).toBe(5);
  });

  it("ignores missing indexes", () => {
    expect(getNextIndex([{ index: null }, { index: undefined }, {}])).toBe(0);
  });
});

describe("deal source", () => {
  const dealSources = [
    { value: "direct", label: "Direct customer" },
    { value: "channel", label: "Channel" },
  ];

  it("resolves the configured source label", () => {
    expect(findDealSource(dealSources, "channel")?.label).toBe("Channel");
    expect(findDealSource(dealSources, "unknown")).toBeUndefined();
  });
});

describe("normalizeDealPayload", () => {
  it("sends an emptied sales owner as null so the deal goes to the pool", () => {
    expect(
      normalizeDealPayload({
        name: "Deal",
        source_type: "direct",
        sales_id: undefined,
      }).sales_id,
    ).toBeNull();
    // Clearing an autocomplete may hand over an empty string as well.
    expect(
      normalizeDealPayload({ name: "Deal", sales_id: "" }).sales_id,
    ).toBeNull();
  });

  it("keeps the sales owner when set", () => {
    expect(normalizeDealPayload({ name: "Deal", sales_id: 3 }).sales_id).toBe(
      3,
    );
  });

  it("defaults the source to direct and drops stale channels", () => {
    const normalized = normalizeDealPayload({
      name: "Deal",
      channel_id: 7,
    });
    expect(normalized.source_type).toBe("direct");
    expect(normalized.channel_id).toBeNull();
  });

  it("keeps the channel for channel-sourced deals", () => {
    const normalized = normalizeDealPayload({
      name: "Deal",
      source_type: "channel",
      channel_id: 7,
    });
    expect(normalized.source_type).toBe("channel");
    expect(normalized.channel_id).toBe(7);
  });

  it("nulls the channel when a channel deal has none selected", () => {
    const normalized = normalizeDealPayload({
      name: "Deal",
      source_type: "channel",
      channel_id: undefined,
    });
    expect(normalized.channel_id).toBeNull();
  });
});
