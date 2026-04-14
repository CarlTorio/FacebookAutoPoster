import type { CredentialsByService } from "@/lib/db/types";

export type TestResult = { ok: true; message: string } | { ok: false; message: string };

async function testClaude(creds: CredentialsByService["claude"]): Promise<TestResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": creds.api_key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (res.ok) return { ok: true, message: "Claude OK" };
  const body = await res.text();
  return { ok: false, message: `Claude ${res.status}: ${body.slice(0, 200)}` };
}

async function testGemini(creds: CredentialsByService["gemini"]): Promise<TestResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(creds.api_key)}`,
  );
  if (res.ok) return { ok: true, message: "Gemini OK" };
  const body = await res.text();
  return { ok: false, message: `Gemini ${res.status}: ${body.slice(0, 200)}` };
}

async function testFacebook(creds: CredentialsByService["facebook"]): Promise<TestResult> {
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(creds.page_id)}?fields=id,name&access_token=${encodeURIComponent(creds.page_access_token)}`;
  const res = await fetch(url);
  const body = await res.text();
  if (res.ok) {
    try {
      const json = JSON.parse(body) as { name?: string };
      return { ok: true, message: `Facebook OK (${json.name ?? creds.page_id})` };
    } catch {
      return { ok: true, message: "Facebook OK" };
    }
  }
  return { ok: false, message: `Facebook ${res.status}: ${body.slice(0, 200)}` };
}

async function testTelegram(creds: CredentialsByService["telegram"]): Promise<TestResult> {
  const res = await fetch(
    `https://api.telegram.org/bot${creds.bot_token}/getMe`,
  );
  const body = await res.text();
  if (res.ok) return { ok: true, message: "Telegram OK" };
  return { ok: false, message: `Telegram ${res.status}: ${body.slice(0, 200)}` };
}

export async function testConnection(
  service: keyof CredentialsByService,
  credentials: CredentialsByService[keyof CredentialsByService],
): Promise<TestResult> {
  try {
    switch (service) {
      case "claude":
        return await testClaude(credentials as CredentialsByService["claude"]);
      case "gemini":
        return await testGemini(credentials as CredentialsByService["gemini"]);
      case "facebook":
        return await testFacebook(
          credentials as CredentialsByService["facebook"],
        );
      case "telegram":
        return await testTelegram(
          credentials as CredentialsByService["telegram"],
        );
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
