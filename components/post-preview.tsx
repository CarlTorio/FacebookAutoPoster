import Image from "next/image";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Post, PostStatus } from "@/lib/db/types";

type BrandSummary = { id: string; name: string; fb_page_name: string | null };

export type PostWithBrand = Post & { brand: BrandSummary | null };

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "" },
    pending_approval: {
      label: "Pending",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    approved: {
      label: "Approved",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    posted: {
      label: "Posted",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    rejected: {
      label: "Rejected",
      className: "bg-gray-100 text-gray-700 border-gray-200",
    },
    failed: {
      label: "Failed",
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };
  const { label, className } = map[status];
  if (!className) return <Badge variant="outline">{label}</Badge>;
  return <Badge className={className}>{label}</Badge>;
}

export function PostPreview({
  post,
  actions,
}: {
  post: PostWithBrand;
  actions?: React.ReactNode;
}) {
  const pageName = post.brand?.fb_page_name ?? post.brand?.name ?? "Page";
  const timeLabel = post.posted_at
    ? format(new Date(post.posted_at), "MMM d, yyyy · h:mm a")
    : post.scheduled_for
      ? `Scheduled ${format(new Date(post.scheduled_for), "MMM d, h:mm a")}`
      : format(new Date(post.created_at), "MMM d, h:mm a");

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
            {pageName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{pageName}</p>
            <p className="text-xs text-muted-foreground">{timeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs">
            {post.post_type.replace("_", " ")}
          </Badge>
          <StatusBadge status={post.status} />
        </div>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {post.hook ? (
          <p className="text-sm font-medium">{post.hook}</p>
        ) : null}
        <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
        {post.cta ? (
          <p className="text-sm font-medium text-primary">{post.cta}</p>
        ) : null}
        {post.hashtags.length > 0 ? (
          <p className="text-sm text-blue-600">
            {post.hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        ) : null}
      </div>

      {post.image_url ? (
        <div className="relative w-full aspect-[4/3] bg-muted">
          <Image
            src={post.image_url}
            alt={post.image_prompt ?? "Post image"}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}

      {post.image_urls.length > 0 ? (
        <div className="grid grid-cols-2 gap-1 bg-muted">
          {post.image_urls.slice(0, 4).map((url, i) => (
            <div key={i} className="relative aspect-square">
              <Image
                src={url}
                alt={`Carousel image ${i + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      ) : null}

      {post.error_message ? (
        <div className="px-4 py-2 bg-red-50 border-t text-xs text-red-700">
          {post.error_message}
        </div>
      ) : null}

      {post.fb_permalink ? (
        <div className="px-4 py-2 border-t text-xs">
          <a
            href={post.fb_permalink}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            View on Facebook →
          </a>
        </div>
      ) : null}

      {actions ? (
        <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
