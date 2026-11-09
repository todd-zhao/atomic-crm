import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Harness, createRegistry } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { config } from "./config";
import { CrmAssistantExtension } from "./crm/extension";
import { models } from "./models";

export const CTX = BACKGROUND_CONTEXT;

let harnessPromise: Promise<Harness> | undefined;

/**
 * One Harness per process over one SQLite file. The service is the only writer
 * (pi-durable assumes a single owning process per storage).
 */
export function getHarness(): Promise<Harness> {
  if (!harnessPromise) {
    harnessPromise = openHarness().catch((error) => {
      harnessPromise = undefined;
      throw error;
    });
  }
  return harnessPromise;
}

async function openHarness(): Promise<Harness> {
  const storage = await openNodeSqliteStorage(config.sqlitePath);
  const registry = createRegistry();
  registry.install(CrmAssistantExtension);

  const harness = await Harness.open(
    storage,
    {
      models,
      registry,
      settings: {
        // A failed model request is retried a couple of times before the run
        // ends with reason "model_error" (surfaced to the UI via runFailure).
        retry: { maxRetries: 2 },
        // Compact long conversations in the background instead of overflowing
        // the provider context window.
        compaction: { reserveTokens: 16_384 },
        progress: { partialIntervalMs: 100, outputIntervalMs: 100 },
        toolExecution: "parallel",
        contextRetentionMs: 600_000,
      },
      onReport: (error, info) => {
        const message =
          error instanceof Error
            ? `${error.message}\n${error.stack ?? ""}`
            : String(error);
        console.warn(`[harness] ${(info as any).type ?? "report"}: ${message}`);
      },
    },
    CTX,
  );

  // Resume anything a previous process left unfinished (crash recovery).
  harness.resume();
  return harness;
}

/** Close the Harness gracefully (waits for running task code to return). */
export async function closeHarness(): Promise<void> {
  if (!harnessPromise) return;
  try {
    const harness = await harnessPromise;
    await harness.close(CTX);
  } catch (error) {
    console.warn("[harness] close failed:", error);
  }
  harnessPromise = undefined;
}
