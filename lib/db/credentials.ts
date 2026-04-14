// MVP: base64-encode sensitive fields. Migrate to Supabase Vault for production.
import type { ApiKeyService, CredentialsByService } from "./types";

const ENCODED_FIELDS: Record<ApiKeyService, string[]> = {
  claude: ["api_key"],
  gemini: ["api_key"],
  facebook: ["app_secret", "page_access_token"],
  telegram: ["bot_token"],
};

function b64encode(v: string) {
  return Buffer.from(v, "utf8").toString("base64");
}

function b64decode(v: string) {
  return Buffer.from(v, "base64").toString("utf8");
}

export function encodeCredentials<S extends ApiKeyService>(
  service: S,
  creds: CredentialsByService[S],
): CredentialsByService[S] {
  const fields = ENCODED_FIELDS[service];
  const out: Record<string, unknown> = { ...creds };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === "string" && v.length > 0) out[f] = b64encode(v);
  }
  return out as CredentialsByService[S];
}

export function decodeCredentials<S extends ApiKeyService>(
  service: S,
  creds: CredentialsByService[S],
): CredentialsByService[S] {
  const fields = ENCODED_FIELDS[service];
  const out: Record<string, unknown> = { ...creds };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === "string" && v.length > 0) {
      try {
        out[f] = b64decode(v);
      } catch {
        // leave as-is if not valid base64
      }
    }
  }
  return out as CredentialsByService[S];
}

// For UI display: return creds with encoded fields replaced by a masked marker.
// The client should never receive decoded secrets.
export function maskCredentials<S extends ApiKeyService>(
  service: S,
  creds: CredentialsByService[S],
): Record<string, string | undefined> {
  const fields = new Set(ENCODED_FIELDS[service]);
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (fields.has(k) && typeof v === "string" && v.length > 0) {
      out[k] = "••••••••";
    } else {
      out[k] = typeof v === "string" ? v : undefined;
    }
  }
  return out;
}
