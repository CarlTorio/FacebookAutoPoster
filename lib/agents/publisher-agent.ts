// Facebook Graph API v21.0 publisher.
// text_only        → POST /{page_id}/feed { message }
// text_with_image  → POST /{page_id}/photos { url, message }
// carousel         → upload each image with published=false, then POST /feed with attached_media

import type { FacebookCredentials, PostType } from "@/lib/db/types";

const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishResult = {
  fb_post_id: string;
  fb_permalink: string | null;
};

type PublishInput = {
  creds: FacebookCredentials;
  postType: PostType;
  message: string;
  imageUrl?: string | null;
  imageUrls?: string[];
};

async function graphPost(
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const form = new URLSearchParams(body);
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`FB Graph ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message;
    throw new Error(`FB Graph ${res.status}: ${err ?? text.slice(0, 300)}`);
  }
  return json;
}

async function fetchPermalink(
  postId: string,
  token: string,
): Promise<string | null> {
  const res = await fetch(
    `${GRAPH}/${encodeURIComponent(postId)}?fields=permalink_url&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { permalink_url?: string };
  return json.permalink_url ?? null;
}

async function publishText(input: PublishInput): Promise<PublishResult> {
  const { creds, message } = input;
  const res = await graphPost(`/${encodeURIComponent(creds.page_id)}/feed`, {
    message,
    access_token: creds.page_access_token,
  });
  const id = String(res.id ?? "");
  if (!id) throw new Error("FB /feed returned no id");
  const permalink = await fetchPermalink(id, creds.page_access_token);
  return { fb_post_id: id, fb_permalink: permalink };
}

async function publishSingleImage(input: PublishInput): Promise<PublishResult> {
  const { creds, message, imageUrl } = input;
  if (!imageUrl) throw new Error("publishSingleImage requires imageUrl");
  const res = await graphPost(`/${encodeURIComponent(creds.page_id)}/photos`, {
    url: imageUrl,
    caption: message,
    access_token: creds.page_access_token,
  });
  const id = String(res.post_id ?? res.id ?? "");
  if (!id) throw new Error("FB /photos returned no id");
  const permalink = await fetchPermalink(id, creds.page_access_token);
  return { fb_post_id: id, fb_permalink: permalink };
}

async function uploadUnpublishedPhoto(
  creds: FacebookCredentials,
  imageUrl: string,
): Promise<string> {
  const res = await graphPost(`/${encodeURIComponent(creds.page_id)}/photos`, {
    url: imageUrl,
    published: "false",
    access_token: creds.page_access_token,
  });
  const id = String(res.id ?? "");
  if (!id) throw new Error("FB unpublished /photos returned no id");
  return id;
}

async function publishCarousel(input: PublishInput): Promise<PublishResult> {
  const { creds, message, imageUrls } = input;
  if (!imageUrls || imageUrls.length < 2) {
    throw new Error("publishCarousel requires at least 2 image URLs");
  }

  const mediaIds: string[] = [];
  for (const url of imageUrls) {
    mediaIds.push(await uploadUnpublishedPhoto(creds, url));
  }

  const body: Record<string, string> = {
    message,
    access_token: creds.page_access_token,
  };
  mediaIds.forEach((id, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });

  const res = await graphPost(
    `/${encodeURIComponent(creds.page_id)}/feed`,
    body,
  );
  const id = String(res.id ?? "");
  if (!id) throw new Error("FB carousel /feed returned no id");
  const permalink = await fetchPermalink(id, creds.page_access_token);
  return { fb_post_id: id, fb_permalink: permalink };
}

export async function publishToFacebook(
  input: PublishInput,
): Promise<PublishResult> {
  switch (input.postType) {
    case "text_only":
      return publishText(input);
    case "text_with_image":
      return publishSingleImage(input);
    case "carousel":
      return publishCarousel(input);
  }
}

// Exchange a short-lived page token for a fresh long-lived one.
// Returns { access_token, expires_at } where expires_at is ISO8601 or null.
export async function refreshPageToken(
  creds: FacebookCredentials,
): Promise<{ access_token: string; expires_at: string | null }> {
  const url =
    `${GRAPH}/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${encodeURIComponent(creds.app_id)}&` +
    `client_secret=${encodeURIComponent(creds.app_secret)}&` +
    `fb_exchange_token=${encodeURIComponent(creds.page_access_token)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FB token refresh ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as {
    access_token: string;
    expires_in?: number;
  };
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : null;
  return { access_token: json.access_token, expires_at: expiresAt };
}

export function buildMessage(parts: {
  caption: string;
  cta: string;
  hashtags: string[];
}): string {
  const tags = parts.hashtags
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  return [parts.caption.trim(), parts.cta.trim(), tags].filter(Boolean).join("\n\n");
}
