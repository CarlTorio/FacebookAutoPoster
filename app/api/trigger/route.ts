import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const triggerSchema = z
  .object({
    brand_id: z.string().uuid().optional(),
    force: z.boolean().optional(),
  })
  .optional();

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const isCron = cronSecret && headerSecret === cronSecret;

  // Auth: either valid cron secret OR a logged-in user.
  if (!isCron) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Use admin client to bypass RLS (cron has no user session; manual trigger
  // needs to write logs even if the UI session would block inserts).
  const supabase = createAdminClient();

  try {
    const summary = await runAgentPipeline({
      supabase,
      baseUrl: baseUrl(request),
      onlyBrandId: parsed.data?.brand_id,
      force: parsed.data?.force,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
