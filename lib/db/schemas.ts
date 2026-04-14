import { z } from "zod";

// ---------- brands ----------

export const postMixSchema = z
  .object({
    text_only: z.number().min(0).max(1),
    text_with_image: z.number().min(0).max(1),
    carousel: z.number().min(0).max(1),
  })
  .refine(
    (v) => Math.abs(v.text_only + v.text_with_image + v.carousel - 1) < 0.001,
    { message: "post_mix must sum to 1.0" },
  );

export const brandModeSchema = z.enum(["auto", "semi_auto", "paused"]);

const timeOfDay = /^\d{2}:\d{2}$/;

export const brandInputSchema = z.object({
  name: z.string().min(1).max(120),
  niche: z.string().max(200).optional().nullable(),
  tone_description: z.string().max(2000).optional().nullable(),
  signature_phrase: z.string().max(200).optional().nullable(),
  banned_words: z.array(z.string().max(80)).default([]),
  target_audience: z.string().max(500).optional().nullable(),
  fb_page_id: z.string().max(80).optional().nullable(),
  fb_page_name: z.string().max(200).optional().nullable(),
  posting_times: z
    .array(z.string().regex(timeOfDay, "Use HH:MM 24-hour format"))
    .default([]),
  timezone: z.string().default("Asia/Manila"),
  post_mix: postMixSchema,
  mode: brandModeSchema.default("paused"),
});

export type BrandInput = z.infer<typeof brandInputSchema>;

// ---------- api_keys ----------

export const claudeCredsSchema = z.object({
  api_key: z.string().min(10),
});

export const geminiCredsSchema = z.object({
  api_key: z.string().min(10),
});

export const facebookCredsSchema = z.object({
  app_id: z.string().min(1),
  app_secret: z.string().min(1),
  page_id: z.string().min(1),
  page_access_token: z.string().min(1),
  token_expires_at: z.string().optional(),
});

export const telegramCredsSchema = z.object({
  bot_token: z.string().min(10),
  chat_id: z.string().min(1),
});

export const apiKeyServiceSchema = z.enum([
  "claude",
  "gemini",
  "facebook",
  "telegram",
]);

export const saveApiKeySchema = z.discriminatedUnion("service", [
  z.object({ service: z.literal("claude"), credentials: claudeCredsSchema }),
  z.object({ service: z.literal("gemini"), credentials: geminiCredsSchema }),
  z.object({
    service: z.literal("facebook"),
    credentials: facebookCredsSchema,
  }),
  z.object({
    service: z.literal("telegram"),
    credentials: telegramCredsSchema,
  }),
]);

export type SaveApiKeyInput = z.infer<typeof saveApiKeySchema>;

export const testConnectionSchema = saveApiKeySchema;

// ---------- posts ----------

export const postStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "rejected",
  "failed",
]);

export const approvePostSchema = z.object({
  post_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export type ApprovePostInput = z.infer<typeof approvePostSchema>;
