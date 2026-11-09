import pg from "pg";
import { config } from "./config";

// pi-durable stores tool details as strict JSON, and `pg` converts date and
// timestamp columns to JS Date objects by default. Return ISO strings instead.
pg.types.setTypeParser(1082, (value: string) => value); // date
pg.types.setTypeParser(1114, (value: string) => value); // timestamp
pg.types.setTypeParser(1184, (value: string) => value); // timestamptz

export const pool = new pg.Pool({
  connectionString: config.supabaseDbUrl,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export type QueryOptions = {
  readOnly?: boolean;
};

/**
 * Run one statement as the `authenticated` role with the caller's verified
 * claims, so Row Level Security and the CRM triggers (sales_id, avatars, ...)
 * behave exactly as for PostgREST. Mirrors supabase/functions/mcp/rlsPostgres.ts.
 */
export async function queryAs<T = Record<string, unknown>>(
  userId: string,
  text: string,
  params: unknown[] = [],
  options: QueryOptions = {},
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (options.readOnly) await client.query("set transaction read only");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await client.query("set local role authenticated");
    await client.query("set local statement_timeout = '8s'");
    const result = await client.query(text, params);
    await client.query("commit");
    return result.rows as T[];
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback failures
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Server-only queries (assistant_credentials, thread lookup) run as postgres. */
export async function queryPrivileged<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
