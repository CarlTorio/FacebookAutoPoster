import { createClient } from "@/lib/supabase/server";
import { PostPreview, type PostWithBrand } from "@/components/post-preview";
import { QueueActions } from "./queue-actions";

export default async function QueuePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*, brand:brands!inner(id,name,user_id,fb_page_name)")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as PostWithBrand[];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Content queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Posts waiting for your approval.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load queue: {error.message}
        </p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No pending posts. The agent will drop new ones here when brands are
            set to semi-auto.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostPreview
              key={post.id}
              post={post}
              actions={<QueueActions postId={post.id} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
