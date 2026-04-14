import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { LogsFilters } from "./logs-filters";
import type { LogRow, LogLevel } from "@/lib/db/types";

const LIMIT = 200;

function levelClass(level: LogLevel): string {
  switch (level) {
    case "error":
      return "bg-red-100 text-red-800 border-red-200";
    case "warn":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "info":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "debug":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; brand?: string }>;
}) {
  const { level, brand } = await searchParams;
  const supabase = await createClient();

  const { data: brandRows } = await supabase
    .from("brands")
    .select("id,name")
    .order("name", { ascending: true });
  const brands = brandRows ?? [];

  let query = supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (level && level !== "all") query = query.eq("level", level);
  if (brand && brand !== "all") query = query.eq("brand_id", brand);

  const { data, error } = await query;
  const logs = (data ?? []) as LogRow[];

  const brandNames = new Map(brands.map((b) => [b.id, b.name]));

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Latest {LIMIT} entries from the agent pipeline.
        </p>
      </div>

      <div className="mb-6">
        <LogsFilters brands={brands} />
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load logs: {error.message}
        </p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No logs yet. The agent writes here once Sprint 6 ships.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {logs.map((log) => (
            <div
              key={log.id}
              className="px-4 py-2.5 flex items-start gap-3 text-sm"
            >
              <Badge className={"shrink-0 text-[10px] " + levelClass(log.level)}>
                {log.level.toUpperCase()}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground font-mono w-36">
                {format(new Date(log.created_at), "MMM d HH:mm:ss")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground w-36 truncate">
                {log.source}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground w-40 truncate">
                {log.brand_id ? brandNames.get(log.brand_id) ?? "—" : "—"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="break-words">{log.message}</span>
                {log.metadata ? (
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      metadata
                    </summary>
                    <pre className="mt-1 text-[11px] bg-muted rounded p-2 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
