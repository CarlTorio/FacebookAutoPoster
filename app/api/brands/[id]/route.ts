import { NextResponse } from "next/server";
import { brandInputSchema } from "@/lib/db/schemas";
import { requireUser, badRequest, serverError } from "@/lib/api/auth";

async function getId(
  params: Promise<{ id: string }>,
): Promise<string> {
  const { id } = await params;
  return id;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  const id = await getId(params);
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return serverError(error.message);
  }
  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  // Allow partial updates.
  const parsed = brandInputSchema.partial().safeParse(json);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.issues);
  }

  const id = await getId(params);
  const { data, error } = await supabase
    .from("brands")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  const id = await getId(params);
  const { error } = await supabase
    .from("brands")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return serverError(error.message);
  return NextResponse.json({ ok: true });
}
