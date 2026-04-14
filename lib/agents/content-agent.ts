import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Brand, Post, PostType } from "@/lib/db/types";
import {
  buildContentDecisionUserMessage,
  contentDecisionSystemPrompt,
} from "@/lib/prompts/content-decision";

const MODEL = "claude-sonnet-4-5";

const contentResponseSchema = z.object({
  post_type: z.enum(["text_only", "text_with_image", "carousel"]),
  topic: z.string().min(1).max(200),
  hook: z.string().min(1).max(300),
  caption: z.string().min(1).max(4000),
  cta: z.string().min(1).max(300),
  hashtags: z.array(z.string().min(1).max(60)).max(12),
  image_prompt: z.string().max(1000).optional(),
});

export type ContentDecision = z.infer<typeof contentResponseSchema>;

type HistoryEntry = Pick<
  Post,
  "post_type" | "topic" | "hook" | "caption" | "hashtags" | "created_at"
>;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function enforceBannedWords(decision: ContentDecision, banned: string[]) {
  if (banned.length === 0) return;
  const haystack =
    `${decision.hook}\n${decision.caption}\n${decision.cta}`.toLowerCase();
  const hit = banned.find((w) => w && haystack.includes(w.toLowerCase()));
  if (hit) {
    throw new Error(`Content contains banned word: "${hit}"`);
  }
}

export async function generateContent(args: {
  apiKey: string;
  brand: Brand;
  history: HistoryEntry[];
  postType: PostType;
}): Promise<ContentDecision> {
  const { apiKey, brand, history, postType } = args;
  const client = new Anthropic({ apiKey });

  const userMessage = buildContentDecisionUserMessage({
    brand,
    history,
    chosenPostType: postType,
  });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: contentDecisionSystemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const raw = extractJson(textBlock.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Claude response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const validated = contentResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Claude response failed schema validation: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  if (postType !== "text_only" && !validated.data.image_prompt) {
    throw new Error(`Missing image_prompt for post_type ${postType}`);
  }

  enforceBannedWords(validated.data, brand.banned_words);
  return { ...validated.data, post_type: postType };
}
