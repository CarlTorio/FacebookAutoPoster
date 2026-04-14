import type { TelegramCredentials } from "@/lib/db/types";

export async function sendTelegramMessage(args: {
  creds: TelegramCredentials;
  text: string;
}): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${args.creds.bot_token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: args.creds.chat_id,
        text: args.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram ${res.status}: ${body.slice(0, 200)}`);
  }
}

export function buildApprovalMessage(args: {
  brandName: string;
  postType: string;
  hook: string | null;
  caption: string;
  approveUrl: string;
}): string {
  const excerpt =
    args.caption.length > 400 ? args.caption.slice(0, 400) + "…" : args.caption;
  return [
    `<b>Pending approval — ${escapeHtml(args.brandName)}</b>`,
    `Type: <code>${escapeHtml(args.postType)}</code>`,
    args.hook ? `Hook: ${escapeHtml(args.hook)}` : "",
    "",
    escapeHtml(excerpt),
    "",
    `Review: ${args.approveUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
