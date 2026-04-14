import { NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/api/auth";
import { postStatusSchema } from "@/lib/db/schemas";

export async function GET(request: Request) {
  const { user, supabase, response: authError } = await requireUser();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const brandId = searchParams.get("brand_id");
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200);

  let query = supabase
    .from("posts")
    .select("*, brand:brands!inner(id,name,user_id,fb_page_name)")
    .eq("brand.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusParam) {
    const statuses = statusParam.split(",");
    const parsed = statuses.map((s) => postStatusSchema.safeParse(s));
    const valid = parsed
      .filter((p) => p.success)
      .map((p) => (p as { success: true; data: string }).data);
    if (valid.length > 0) query = query.in("status", valid);
  }
  if (brandId) query = query.eq("brand_id", brandId);

  const { data, error } = await query;
  if (error) return serverError(error.message);
  return NextResponse.json({ data });
}
