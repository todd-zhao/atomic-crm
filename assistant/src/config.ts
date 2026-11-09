import fs from "node:fs";

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const supabaseUrl = (
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
).replace(/\/+$/, "");

export const config = {
  port: num(process.env.PORT, 8787),
  supabaseUrl,
  supabaseDbUrl:
    process.env.SUPABASE_DB_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  jwksUrl:
    process.env.SUPABASE_JWKS_URL ??
    `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  encryptionKey: process.env.ASSISTANT_ENCRYPTION_KEY ?? "",
  sqlitePath: process.env.ASSISTANT_SQLITE_PATH ?? "./data/assistant.sqlite",
  corsOrigins: (process.env.ASSISTANT_CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  contextWindow: num(process.env.ASSISTANT_CONTEXT_WINDOW, 128_000),
  maxOutputTokens: num(process.env.ASSISTANT_MAX_OUTPUT_TOKENS, 8_192),
  maxTurns: num(process.env.ASSISTANT_MAX_TURNS, 24),
  version: "1.0.0",
} as const;

/** Fail fast on configuration that would silently break at runtime. */
export function assertConfig(): void {
  if (!config.encryptionKey) {
    throw new Error(
      "ASSISTANT_ENCRYPTION_KEY is required (32 random bytes, base64). See assistant/.env.example.",
    );
  }
  const key = Buffer.from(config.encryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ASSISTANT_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}. See assistant/.env.example.`,
    );
  }
  if (!fs.existsSync(config.sqlitePath)) {
    const dir = config.sqlitePath.slice(
      0,
      Math.max(0, config.sqlitePath.lastIndexOf("/")),
    );
    if (dir) fs.mkdirSync(dir, { recursive: true });
  }
}
