import { NextResponse } from "next/server";
import { saveApiKeySchema } from "@/lib/db/schemas";
import { encodeCredentials, maskCredentials } from "@/lib/db/credentials";
import { testConnection } from "@/lib/services/test-connection";
import { requireUser, badRequest, serverError } from "@/lib/api/auth";
import type { ApiKeyRow, ApiKeyService } from "@/lib/db/types";

export async function GET() {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id);

  if (error) return serverError(error.message);

  // Never return decoded secrets to the client.
  const masked = (data as ApiKeyRow[]).map((row) => ({
    ...row,
    credentials: maskCredentials(row.service, row.credentials),
  }));

  return NextResponse.json({ data: masked });
}

export async function POST(request: Request) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = saveApiKeySchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.issues);
  }

  const { service, credentials } = parsed.data;

  // Test the connection before saving so we never persist broken creds silently.
  const test = await testConnection(service as ApiKeyService, credentials);

  const encoded = encodeCredentials(service as ApiKeyService, credentials);

  const { data, error } = await supabase
    .from("api_keys")
    .upsert(
      {
        user_id: user.id,
        service,
        credentials: encoded,
        last_tested_at: new Date().toISOString(),
        last_test_ok: test.ok,
        last_test_message: test.message,
      },
      { onConflict: "user_id,service" },
    )
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: {
      ...data,
      credentials: maskCredentials(service as ApiKeyService, data.credentials),
    },
    test,
  });
}
