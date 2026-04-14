import { NextResponse } from "next/server";
import { brandInputSchema } from "@/lib/db/schemas";
import { requireUser, badRequest, serverError } from "@/lib/api/auth";

export async function GET() {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return serverError(error.message);
  return NextResponse.json({ data });
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

  const parsed = brandInputSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.issues);
  }

  const { data, error } = await supabase
    .from("brands")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json({ data }, { status: 201 });
}
