import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogLevel } from "@/lib/db/types";

export type LogInput = {
  level: LogLevel;
  source: string;
  message: string;
  brand_id?: string | null;
  post_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeLog(
  supabase: SupabaseClient,
  entry: LogInput,
): Promise<void> {
  const { error } = await supabase.from("logs").insert({
    level: entry.level,
    source: entry.source,
    message: entry.message,
    brand_id: entry.brand_id ?? null,
    post_id: entry.post_id ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) {
    console.error("[logger] insert failed:", error.message, entry);
  }
}
