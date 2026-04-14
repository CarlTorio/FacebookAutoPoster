import Link from "next/link";
import { notFound } from "next/navigation";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BrandForm } from "@/components/brand-form";
import { RunNowButton } from "@/components/run-now-button";
import type { Brand } from "@/lib/db/types";
import type { brandInputSchema } from "@/lib/db/schemas";

type BrandInput = z.input<typeof brandInputSchema>;

function toFormValues(b: Brand): Partial<BrandInput> {
  return {
    name: b.name,
    niche: b.niche ?? "",
    tone_description: b.tone_description ?? "",
    signature_phrase: b.signature_phrase ?? "",
    banned_words: b.banned_words ?? [],
    target_audience: b.target_audience ?? "",
    fb_page_id: b.fb_page_id ?? "",
    fb_page_name: b.fb_page_name ?? "",
    posting_times: b.posting_times ?? [],
    timezone: b.timezone,
    post_mix: b.post_mix,
    mode: b.mode,
  };
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  let defaults: Partial<BrandInput> | undefined;
  let title = "New brand";

  if (!isNew) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return notFound();
    const brand = data as Brand;
    defaults = toFormValues(brand);
    title = brand.name;
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link
            href="/brands"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to brands
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isNew
              ? "Configure a new brand."
              : "Update this brand's configuration."}
          </p>
        </div>
        {!isNew ? <RunNowButton brandId={id} /> : null}
      </div>
      <BrandForm
        mode={isNew ? "create" : "edit"}
        brandId={isNew ? undefined : id}
        defaultValues={defaults}
      />
    </div>
  );
}
