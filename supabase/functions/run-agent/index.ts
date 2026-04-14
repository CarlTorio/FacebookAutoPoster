// Deno edge function wrapper. Forwards to the Next.js /api/trigger endpoint so
// the full agent pipeline lives in one place (the Next app).
//
// Expected env vars (set via `supabase secrets set`):
//   AGENTFB_URL         — https://your-vercel-app.vercel.app
//   AGENTFB_CRON_SECRET — shared secret matching CRON_SECRET on Vercel

Deno.serve(async (req) => {
  const appUrl = Deno.env.get("AGENTFB_URL");
  const secret = Deno.env.get("AGENTFB_CRON_SECRET");
  if (!appUrl || !secret) {
    return new Response(
      JSON.stringify({ error: "Missing AGENTFB_URL or AGENTFB_CRON_SECRET" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const res = await fetch(`${appUrl}/api/trigger`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": secret,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});
