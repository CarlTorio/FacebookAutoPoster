import { NextResponse } from "next/server";
import { testConnectionSchema } from "@/lib/db/schemas";
import { testConnection } from "@/lib/services/test-connection";
import { requireUser, badRequest } from "@/lib/api/auth";

export async function POST(request: Request) {
  const { response: authError } = await requireUser();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = testConnectionSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.issues);
  }

  const result = await testConnection(
    parsed.data.service,
    parsed.data.credentials,
  );
  return NextResponse.json(result);
}
