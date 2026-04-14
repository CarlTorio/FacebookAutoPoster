import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MODEL = "gemini-2.5-flash-image";
const BUCKET = "post-images";

export type GeneratedImage = { url: string; path: string };

function decodeBase64(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

async function generateOne(args: {
  apiKey: string;
  prompt: string;
}): Promise<{ bytes: Uint8Array; mime: string }> {
  const genai = new GoogleGenerativeAI(args.apiKey);
  const model = genai.getGenerativeModel({ model: MODEL });
  const res = await model.generateContent(args.prompt);

  const parts = res.response.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = (p as { inlineData?: { data: string; mimeType: string } })
      .inlineData;
    if (inline?.data) {
      return {
        bytes: decodeBase64(inline.data),
        mime: inline.mimeType || "image/png",
      };
    }
  }
  throw new Error("Gemini returned no inline image data");
}

async function uploadToStorage(args: {
  supabase: SupabaseClient;
  brandId: string;
  bytes: Uint8Array;
  mime: string;
}): Promise<GeneratedImage> {
  const ext = args.mime.split("/")[1]?.split("+")[0] || "png";
  const path = `${args.brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await args.supabase.storage
    .from(BUCKET)
    .upload(path, args.bytes, { contentType: args.mime, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: pub } = args.supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

export async function generateImage(args: {
  apiKey: string;
  supabase: SupabaseClient;
  brandId: string;
  prompt: string;
}): Promise<GeneratedImage> {
  const { bytes, mime } = await generateOne({
    apiKey: args.apiKey,
    prompt: args.prompt,
  });
  return uploadToStorage({
    supabase: args.supabase,
    brandId: args.brandId,
    bytes,
    mime,
  });
}

export async function generateCarousel(args: {
  apiKey: string;
  supabase: SupabaseClient;
  brandId: string;
  prompt: string;
  count: number;
}): Promise<GeneratedImage[]> {
  const n = Math.max(2, Math.min(4, args.count));
  const variants = Array.from({ length: n }, (_, i) =>
    i === 0
      ? args.prompt
      : `${args.prompt} — variation ${i + 1}, same visual style, different composition`,
  );
  const images: GeneratedImage[] = [];
  for (const prompt of variants) {
    const { bytes, mime } = await generateOne({ apiKey: args.apiKey, prompt });
    const uploaded = await uploadToStorage({
      supabase: args.supabase,
      brandId: args.brandId,
      bytes,
      mime,
    });
    images.push(uploaded);
  }
  return images;
}
