// Scheduled job (run weekly) to refresh long-lived Facebook page tokens.
// For each api_keys row with service='facebook', it exchanges the current
// page_access_token for a fresh long-lived one and updates the DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";

function b64decode(v: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(v), (c) => c.charCodeAt(0)),
  );
}

function b64encode(v: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(v)));
}

function safeDecode(v: string): string {
  try {
    return b64decode(v);
  } catch {
    return v;
  }
}

type FacebookCreds = {
  app_id: string;
  app_secret: string;
  page_id: string;
  page_access_token: string;
  token_expires_at?: string;
};

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(
      JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("api_keys")
    .select("id,user_id,credentials")
    .eq("service", "facebook");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const row of rows ?? []) {
    const stored = row.credentials as FacebookCreds;
    try {
      const decoded: FacebookCreds = {
        ...stored,
        app_secret: safeDecode(stored.app_secret),
        page_access_token: safeDecode(stored.page_access_token),
      };

      const exchangeUrl =
        `${GRAPH}/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${encodeURIComponent(decoded.app_id)}&` +
        `client_secret=${encodeURIComponent(decoded.app_secret)}&` +
        `fb_exchange_token=${encodeURIComponent(decoded.page_access_token)}`;
      const res = await fetch(exchangeUrl);
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      const json = JSON.parse(text) as {
        access_token: string;
        expires_in?: number;
      };

      const expiresAt = json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null;

      await supabase
        .from("api_keys")
        .update({
          credentials: {
            ...stored,
            page_access_token: b64encode(json.access_token),
            token_expires_at: expiresAt ?? stored.token_expires_at,
          },
          last_tested_at: new Date().toISOString(),
          last_test_ok: true,
          last_test_message: "Token refreshed",
        })
        .eq("id", row.id);

      results.push({ id: row.id, ok: true, message: "refreshed" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("api_keys")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_ok: false,
          last_test_message: `Refresh failed: ${msg}`,
        })
        .eq("id", row.id);
      results.push({ id: row.id, ok: false, message: msg });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  });
});
