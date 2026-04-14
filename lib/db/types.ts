// Types mirroring the schema in supabase/migrations/001_initial_schema.sql.
// Regenerate manually when the schema changes (or switch to `supabase gen types typescript`).

export type BrandMode = "auto" | "semi_auto" | "paused";
export type PostType = "text_only" | "text_with_image" | "carousel";
export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "rejected"
  | "failed";
export type ApiKeyService = "claude" | "gemini" | "facebook" | "telegram";
export type LogLevel = "debug" | "info" | "warn" | "error";

export type PostMix = {
  text_only: number;
  text_with_image: number;
  carousel: number;
};

export type Brand = {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  tone_description: string | null;
  signature_phrase: string | null;
  banned_words: string[];
  target_audience: string | null;
  fb_page_id: string | null;
  fb_page_name: string | null;
  posting_times: string[];
  timezone: string;
  post_mix: PostMix;
  mode: BrandMode;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  brand_id: string;
  post_type: PostType;
  topic: string | null;
  hook: string | null;
  caption: string;
  cta: string | null;
  hashtags: string[];
  image_prompt: string | null;
  image_url: string | null;
  image_urls: string[];
  status: PostStatus;
  fb_post_id: string | null;
  fb_permalink: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// Per-service credential shapes stored in api_keys.credentials (jsonb).
export type ClaudeCredentials = { api_key: string };
export type GeminiCredentials = { api_key: string };
export type FacebookCredentials = {
  app_id: string;
  app_secret: string;
  page_id: string;
  page_access_token: string;
  token_expires_at?: string;
};
export type TelegramCredentials = { bot_token: string; chat_id: string };

export type CredentialsByService = {
  claude: ClaudeCredentials;
  gemini: GeminiCredentials;
  facebook: FacebookCredentials;
  telegram: TelegramCredentials;
};

export type ApiKeyRow<S extends ApiKeyService = ApiKeyService> = {
  id: string;
  user_id: string;
  service: S;
  credentials: CredentialsByService[S];
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
};

export type LogRow = {
  id: number;
  brand_id: string | null;
  post_id: string | null;
  level: LogLevel;
  source: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
