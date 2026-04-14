import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeCredentials } from "@/lib/db/credentials";
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
  return decodeCredentials(service, data.credentials as CredentialsByService[S]);
}
