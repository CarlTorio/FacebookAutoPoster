import type { Brand, Post, PostType } from "@/lib/db/types";

type HistoryEntry = Pick<
  Post,
  "post_type" | "topic" | "hook" | "caption" | "hashtags" | "created_at"
>;

export const contentDecisionSystemPrompt = `You are a direct-response copywriter for Philippine Facebook pages. You write in natural **Taglish** (Filipino-English mix as Manila millennials actually speak and text — not formal Tagalog, not pure English). You follow Alex Hormozi, Gary Halbert, and Dan Kennedy:

- **Hook** — stop the scroll in the first line. Curiosity gap, bold claim, or pattern interrupt. No "Hi everyone!" openers.
- **Body** — one clear idea, short sentences, specific over abstract. Use the brand's voice, not yours.
- **CTA** — one concrete next action. Never vague ("learn more"). Always specific ("Comment PRESYO and we'll DM you the price list").

**Hard rules:**
1. Output STRICT JSON only — no markdown fence, no commentary. Must parse with JSON.parse.
2. Respect banned_words exactly. If the brand bans a word, do not use any variant of it.
3. Do NOT repeat a hook, topic, or structural format used in the last 7 days of post history.
4. Caption length: 60–180 words for text_only and text_with_image. 80–220 for carousel.
5. Hashtags: 3–8, lowercase, no spaces, relevant to the niche. No generic #love #instagood fluff.
6. For image_prompt (only when post_type requires an image): describe a single photographic scene in English, 1 sentence, no text overlays, no logos, visually on-brand.
7. Never fabricate prices, promos, or claims. If the brand config doesn't give you a specific offer, write around the topic educationally.`;

export function buildContentDecisionUserMessage(args: {
  brand: Brand;
  history: HistoryEntry[];
  chosenPostType: PostType;
}): string {
  const { brand, history, chosenPostType } = args;

  const historyLines =
    history.length === 0
      ? "(no recent posts — this is the first)"
      : history
          .slice(0, 14)
          .map(
            (h, i) =>
              `${i + 1}. [${h.post_type}] hook="${h.hook ?? ""}" topic="${h.topic ?? ""}"`,
          )
          .join("\n");

  const postMixNote =
    chosenPostType === "text_only"
      ? "Text-only post. No image_prompt field."
      : chosenPostType === "text_with_image"
        ? "Single image post. Include image_prompt."
        : "Carousel (2–4 images). Include image_prompt — the prompt should describe a visually consistent series.";

  return `BRAND CONFIG
name: ${brand.name}
niche: ${brand.niche ?? "—"}
tone: ${brand.tone_description ?? "—"}
signature_phrase: ${brand.signature_phrase ?? "—"}
target_audience: ${brand.target_audience ?? "—"}
banned_words: ${brand.banned_words.length ? brand.banned_words.join(", ") : "(none)"}

POST HISTORY (last 7 days, newest first):
${historyLines}

TASK
Write ONE new Facebook post for this brand. Chosen post_type: **${chosenPostType}**.
${postMixNote}

Return JSON with this exact shape:
{
  "post_type": "${chosenPostType}",
  "topic": "<1-line topic summary>",
  "hook": "<the opening line — must stop the scroll>",
  "caption": "<full Taglish caption, hook already included at the top>",
  "cta": "<one specific next action>",
  "hashtags": ["tag1", "tag2", ...]${chosenPostType === "text_only" ? "" : ',\n  "image_prompt": "<one-sentence English photographic prompt>"'}
}`;
}

export function pickPostType(brand: Brand): PostType {
  const mix = brand.post_mix;
  const r = Math.random();
  if (r < mix.text_only) return "text_only";
  if (r < mix.text_only + mix.text_with_image) return "text_with_image";
  return "carousel";
}
