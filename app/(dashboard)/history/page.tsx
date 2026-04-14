import { createClient } from "@/lib/supabase/server";
import { PostPreview, type PostWithBrand } from "@/components/post-preview";
import { HistoryFilters } from "./history-filters";
import type { PostStatus } from "@/lib/db/types";

const DEFAULT_STATUSES: PostStatus[] = ["posted", "failed", "rejected"];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; brand?: string }>;
}) {
  const { status, brand } = await searchParams;
  const supabase = await createClient();

  const { data: brandRows } = await supabase
    .from("brands")
    .select("id,name")
    .order("name", { ascending: true });
  const brands = brandRows ?? [];

  let query = supabase
    .from("posts")
    .select("*, brand:brands!inner(id,name,user_id,fb_page_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.in("status", DEFAULT_STATUSES);
  }
  if (brand && brand !== "all") {
    query = query.eq("brand_id", brand);
  }

  const { data, error } = await query;
  const posts = (data ?? []) as PostWithBrand[];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Post history</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything that ran through the pipeline.
        </p>
      </div>

      <div className="mb-6">
        <HistoryFilters brands={brands} />
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load history: {error.message}
        </p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No posts match these filters yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostPreview key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
