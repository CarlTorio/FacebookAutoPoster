import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeCredentials } from "@/lib/db/credentials";
import { traceCred } from "@/lib/db/cred-trace";
import type {
  ApiKeyService,
  CredentialsByService,
} from "@/lib/db/types";

export async function loadCredentials<S extends ApiKeyService>(
  supabase: SupabaseClient,
  userId: string,
  service: S,
): Promise<CredentialsByService[S] | null> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("credentials")
    .eq("user_id", userId)
    .eq("service", service)
    .maybeSingle();

  if (error || !data) return null;

  const stored = data.credentials as CredentialsByService[S];
  if (service === "facebook") {
    traceCred(
      "4-after-retrieve",
      (stored as { page_access_token?: string }).page_access_token,
    );
  }

  const decoded = decodeCredentials(service, stored);
  if (service === "facebook") {
    traceCred(
      "5-after-decode",
      (decoded as { page_access_token?: string }).page_access_token,
    );
  }
  return decoded;
}
