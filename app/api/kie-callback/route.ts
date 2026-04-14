// TEMPORARY: inspection-only endpoint to capture the real Kie.ai callback
// payload shape. Records raw body + headers to the logs table, does nothing
// else. Will be replaced by the real handler once we see a real callback.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeLog } from "@/lib/agents/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const rawBody = await request.text();
  let parsed: unknown = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = { _unparsed: true };
  }

  const supabase = createAdminClient();
  await writeLog(supabase, {
    level: "info",
    source: "kie-callback-inspect",
    message: `Kie.ai callback received (${rawBody.length} bytes)`,
    metadata: {
      headers,
      raw_body: rawBody,
      parsed,
      url: request.url,
      method: request.method,
    },
  });

  return NextResponse.json({ ok: true, received: rawBody.length });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "This is the Kie.ai callback inspector. POST here to record payload.",
  });
}
