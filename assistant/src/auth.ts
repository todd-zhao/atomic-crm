import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config";

export type UserClaims = {
  userId: string;
  role: string;
  email?: string;
};

const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
const hs256Key = config.jwtSecret
  ? new TextEncoder().encode(config.jwtSecret)
  : undefined;

function toClaims(payload: JWTPayload): UserClaims {
  const userId = payload.sub;
  if (!userId) throw new Error("Token has no subject");
  const role = typeof payload.role === "string" ? payload.role : "";
  return {
    userId,
    role,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

export async function verifyAccessToken(token: string): Promise<UserClaims> {
  // Local Supabase and new cloud projects sign user access tokens with ES256 via
  // the project signing keys exposed through the JWKS endpoint.
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["ES256", "RS256", "EdDSA"],
      clockTolerance: 60,
    });
    return toClaims(payload);
  } catch (error) {
    if (!hs256Key) throw error;
    // Legacy Supabase projects sign with the project JWT secret (HS256).
    const { payload } = await jwtVerify(token, hs256Key, {
      algorithms: ["HS256"],
      clockTolerance: 60,
    });
    return toClaims(payload);
  }
}

export function requireAuthenticatedUser(user: UserClaims): void {
  if (user.role !== "authenticated") {
    throw Object.assign(
      new Error("Only authenticated users may use the assistant"),
      {
        status: 403,
        code: "forbidden",
      },
    );
  }
}
