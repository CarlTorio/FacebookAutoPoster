import { NextResponse } from "next/server";
import { approvePostSchema } from "@/lib/db/schemas";
import { requireUser, badRequest, serverError } from "@/lib/api/auth";
import { publishApprovedPost } from "@/lib/agents/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = approvePostSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.issues);
  }
  const { post_id, action, reason } = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("posts")
    .select("id,status,brand:brands!inner(user_id)")
    .eq("id", post_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return serverError(fetchError.message);
  }

  const brand = existing.brand as unknown as { user_id: string };
  if (brand.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "pending_approval") {
    return badRequest(
      `Post is not pending approval (current: ${existing.status}).`,
    );
  }

  if (action === "reject") {
    const { data, error } = await supabase
      .from("posts")
      .update({ status: "rejected", error_message: reason ?? null })
      .eq("id", post_id)
      .select()
      .single();
    if (error) return serverError(error.message);
    return NextResponse.json({ data });
  }

  // Approve → flip to 'approved' then publish via admin client (bypass RLS for logs).
  const { data: approved, error: approveErr } = await supabase
    .from("posts")
    .update({ status: "approved", error_message: null })
    .eq("id", post_id)
    .select()
    .single();
  if (approveErr) return serverError(approveErr.message);

  const admin = createAdminClient();
  const result = await publishApprovedPost({ supabase: admin, postId: post_id });
  if (!result.ok) {
    return NextResponse.json(
      { data: approved, published: false, error: result.error },
      { status: 502 },
    );
  }
  return NextResponse.json({
    data: approved,
    published: true,
    fb_post_id: result.fb_post_id,
  });
}
