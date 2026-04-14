// Agent pipeline orchestrator.
// Picks due brands, runs content + image + publish/approval, writes posts & logs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Post, PostType } from "@/lib/db/types";
import { generateContent, type ContentDecision } from "./content-agent";
import { generateCarousel, generateImage } from "./image-agent";
import { buildMessage, publishToFacebook } from "./publisher-agent";
import { writeLog } from "./logger";
import { loadCredentials } from "./credentials-loader";
import {
  buildApprovalMessage,
  sendTelegramMessage,
} from "@/lib/services/telegram";
import { pickPostType } from "@/lib/prompts/content-decision";

const HISTORY_DAYS = 7;
const SLOT_WINDOW_MIN = 10;
const DUPLICATE_WINDOW_MIN = 55;

type BrandRunOutcome =
  | { status: "skipped"; reason: string }
  | { status: "generated_pending"; post_id: string }
  | { status: "posted"; post_id: string; fb_post_id: string }
  | { status: "failed"; error: string };

export type RunSummary = {
  checkedBrands: number;
  dueBrands: number;
  results: { brand_id: string; brand_name: string; outcome: BrandRunOutcome }[];
};

function nowInBrandTZ(brand: Brand, at: Date): { hh: number; mm: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: brand.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hh, mm };
}

function isBrandDue(brand: Brand, at: Date): boolean {
  if (brand.mode === "paused") return false;
  if (brand.posting_times.length === 0) return false;
  const { hh, mm } = nowInBrandTZ(brand, at);
  const nowMin = hh * 60 + mm;
  return brand.posting_times.some((t) => {
    const [h, m] = t.split(":").map(Number);
    const slotMin = h * 60 + m;
    return Math.abs(nowMin - slotMin) <= SLOT_WINDOW_MIN;
  });
}

async function recentlyRan(
  supabase: SupabaseClient,
  brandId: string,
  at: Date,
): Promise<boolean> {
  const since = new Date(at.getTime() - DUPLICATE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

async function fetchHistory(
  supabase: SupabaseClient,
  brandId: string,
): Promise<
  Pick<Post, "post_type" | "topic" | "hook" | "caption" | "hashtags" | "created_at">[]
> {
  const since = new Date(
    Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data } = await supabase
    .from("posts")
    .select("post_type,topic,hook,caption,hashtags,created_at")
    .eq("brand_id", brandId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function runOneBrand(args: {
  supabase: SupabaseClient;
  brand: Brand;
  baseUrl: string;
}): Promise<BrandRunOutcome> {
  const { supabase, brand, baseUrl } = args;
  const brandId = brand.id;

  await writeLog(supabase, {
    level: "info",
    source: "orchestrator",
    message: `Starting pipeline: ${brand.name}`,
    brand_id: brandId,
  });

  const claudeCreds = await loadCredentials(supabase, brand.user_id, "claude");
  if (!claudeCreds) {
    await writeLog(supabase, {
      level: "error",
      source: "orchestrator",
      message: "Missing Claude credentials",
      brand_id: brandId,
    });
    return { status: "failed", error: "Missing Claude credentials" };
  }

  const postType: PostType = pickPostType(brand);
  const history = await fetchHistory(supabase, brandId);

  let decision: ContentDecision;
  try {
    decision = await generateContent({
      apiKey: claudeCreds.api_key,
      brand,
      history,
      postType,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeLog(supabase, {
      level: "error",
      source: "content-agent",
      message: `Content generation failed: ${msg}`,
      brand_id: brandId,
    });
    return { status: "failed", error: msg };
  }

  await writeLog(supabase, {
    level: "info",
    source: "content-agent",
    message: `Generated ${postType}: ${decision.hook.slice(0, 80)}`,
    brand_id: brandId,
    metadata: { topic: decision.topic, post_type: postType },
  });

  let imageUrl: string | null = null;
  let imageUrls: string[] = [];

  if (postType !== "text_only") {
    const geminiCreds = await loadCredentials(supabase, brand.user_id, "gemini");
    if (!geminiCreds) {
      await writeLog(supabase, {
        level: "error",
        source: "orchestrator",
        message: "Missing Gemini credentials",
        brand_id: brandId,
      });
      return { status: "failed", error: "Missing Gemini credentials" };
    }
    if (!decision.image_prompt) {
      return { status: "failed", error: "Missing image_prompt" };
    }
    try {
      if (postType === "text_with_image") {
        const img = await generateImage({
          apiKey: geminiCreds.api_key,
          supabase,
          brandId,
          prompt: decision.image_prompt,
        });
        imageUrl = img.url;
      } else {
        const imgs = await generateCarousel({
          apiKey: geminiCreds.api_key,
          supabase,
          brandId,
          prompt: decision.image_prompt,
          count: 3,
        });
        imageUrls = imgs.map((i) => i.url);
      }
      await writeLog(supabase, {
        level: "info",
        source: "image-agent",
        message: `Generated ${imageUrls.length || 1} image(s)`,
        brand_id: brandId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await writeLog(supabase, {
        level: "error",
        source: "image-agent",
        message: `Image generation failed: ${msg}`,
        brand_id: brandId,
      });
      return { status: "failed", error: msg };
    }
  }

  const basePostRow = {
    brand_id: brandId,
    post_type: postType,
    topic: decision.topic,
    hook: decision.hook,
    caption: decision.caption,
    cta: decision.cta,
    hashtags: decision.hashtags,
    image_prompt: decision.image_prompt ?? null,
    image_url: imageUrl,
    image_urls: imageUrls,
  };

  if (brand.mode === "semi_auto") {
    const { data: inserted, error: insertErr } = await supabase
      .from("posts")
      .insert({ ...basePostRow, status: "pending_approval" })
      .select()
      .single();
    if (insertErr || !inserted) {
      return { status: "failed", error: insertErr?.message ?? "insert failed" };
    }

    const telegramCreds = await loadCredentials(
      supabase,
      brand.user_id,
      "telegram",
    );
    if (telegramCreds) {
      try {
        await sendTelegramMessage({
          creds: telegramCreds,
          text: buildApprovalMessage({
            brandName: brand.name,
            postType,
            hook: decision.hook,
            caption: decision.caption,
            approveUrl: `${baseUrl}/queue`,
          }),
        });
        await writeLog(supabase, {
          level: "info",
          source: "telegram",
          message: "Approval ping sent",
          brand_id: brandId,
          post_id: inserted.id,
        });
      } catch (e) {
        await writeLog(supabase, {
          level: "warn",
          source: "telegram",
          message: `Approval ping failed: ${e instanceof Error ? e.message : String(e)}`,
          brand_id: brandId,
          post_id: inserted.id,
        });
      }
    }
    return { status: "generated_pending", post_id: inserted.id };
  }

  // mode === "auto" — publish immediately
  const fbCreds = await loadCredentials(supabase, brand.user_id, "facebook");
  if (!fbCreds) return { status: "failed", error: "Missing Facebook credentials" };

  const { data: inserted, error: insertErr } = await supabase
    .from("posts")
    .insert({ ...basePostRow, status: "approved" })
    .select()
    .single();
  if (insertErr || !inserted) {
    return { status: "failed", error: insertErr?.message ?? "insert failed" };
  }

  try {
    const message = buildMessage({
      caption: decision.caption,
      cta: decision.cta,
      hashtags: decision.hashtags,
    });
    const result = await publishToFacebook({
      creds: fbCreds,
      postType,
      message,
      imageUrl,
      imageUrls,
    });
    await supabase
      .from("posts")
      .update({
        status: "posted",
        fb_post_id: result.fb_post_id,
        fb_permalink: result.fb_permalink,
        posted_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);
    await writeLog(supabase, {
      level: "info",
      source: "publisher",
      message: `Posted to Facebook: ${result.fb_permalink ?? result.fb_post_id}`,
      brand_id: brandId,
      post_id: inserted.id,
    });
    return {
      status: "posted",
      post_id: inserted.id,
      fb_post_id: result.fb_post_id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("posts")
      .update({ status: "failed", error_message: msg })
      .eq("id", inserted.id);
    await writeLog(supabase, {
      level: "error",
      source: "publisher",
      message: `Publish failed: ${msg}`,
      brand_id: brandId,
      post_id: inserted.id,
    });
    return { status: "failed", error: msg };
  }
}

export async function runAgentPipeline(args: {
  supabase: SupabaseClient;
  baseUrl: string;
  at?: Date;
  onlyBrandId?: string;
  force?: boolean;
}): Promise<RunSummary> {
  const at = args.at ?? new Date();
  let query = args.supabase.from("brands").select("*").neq("mode", "paused");
  if (args.onlyBrandId) query = query.eq("id", args.onlyBrandId);

  const { data: brandRows } = await query;
  const brands = (brandRows ?? []) as Brand[];

  const summary: RunSummary = {
    checkedBrands: brands.length,
    dueBrands: 0,
    results: [],
  };

  for (const brand of brands) {
    const forceRun = !!args.force;
    const due = forceRun || isBrandDue(brand, at);
    if (due) summary.dueBrands++;

    if (!due) {
      summary.results.push({
        brand_id: brand.id,
        brand_name: brand.name,
        outcome: { status: "skipped", reason: "not due" },
      });
      continue;
    }

    if (!forceRun && (await recentlyRan(args.supabase, brand.id, at))) {
      summary.results.push({
        brand_id: brand.id,
        brand_name: brand.name,
        outcome: { status: "skipped", reason: "already ran this window" },
      });
      continue;
    }

    const outcome = await runOneBrand({
      supabase: args.supabase,
      brand,
      baseUrl: args.baseUrl,
    });
    summary.results.push({
      brand_id: brand.id,
      brand_name: brand.name,
      outcome,
    });
  }

  return summary;
}

// Publishes an already-approved post — called by the approve endpoint.
export async function publishApprovedPost(args: {
  supabase: SupabaseClient;
  postId: string;
}): Promise<{ ok: true; fb_post_id: string } | { ok: false; error: string }> {
  const { supabase, postId } = args;

  const { data: row, error } = await supabase
    .from("posts")
    .select("*, brand:brands!inner(*)")
    .eq("id", postId)
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Post not found" };

  const post = row as Post & { brand: Brand };
  const fbCreds = await loadCredentials(supabase, post.brand.user_id, "facebook");
  if (!fbCreds) return { ok: false, error: "Missing Facebook credentials" };

  try {
    const message = buildMessage({
      caption: post.caption,
      cta: post.cta ?? "",
      hashtags: post.hashtags,
    });
    const result = await publishToFacebook({
      creds: fbCreds,
      postType: post.post_type,
      message,
      imageUrl: post.image_url,
      imageUrls: post.image_urls,
    });
    await supabase
      .from("posts")
      .update({
        status: "posted",
        fb_post_id: result.fb_post_id,
        fb_permalink: result.fb_permalink,
        posted_at: new Date().toISOString(),
      })
      .eq("id", postId);
    await writeLog(supabase, {
      level: "info",
      source: "publisher",
      message: `Posted (approved): ${result.fb_permalink ?? result.fb_post_id}`,
      brand_id: post.brand_id,
      post_id: postId,
    });
    return { ok: true, fb_post_id: result.fb_post_id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("posts")
      .update({ status: "failed", error_message: msg })
      .eq("id", postId);
    await writeLog(supabase, {
      level: "error",
      source: "publisher",
      message: `Publish (approved) failed: ${msg}`,
      brand_id: post.brand_id,
      post_id: postId,
    });
    return { ok: false, error: msg };
  }
}
