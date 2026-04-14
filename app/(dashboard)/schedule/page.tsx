import { format, addDays, startOfDay, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import type { Brand, Post } from "@/lib/db/types";

type ScheduledPost = Pick<
  Post,
  "id" | "brand_id" | "status" | "post_type" | "hook" | "scheduled_for"
>;

const DAY_COUNT = 7;

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function modeColor(mode: Brand["mode"]) {
  if (mode === "auto") return "bg-green-100 text-green-800 border-green-200";
  if (mode === "semi_auto")
    return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export default async function SchedulePage() {
  const supabase = await createClient();

  const [{ data: brandRows }, { data: postRows }] = await Promise.all([
    supabase
      .from("brands")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("posts")
      .select("id,brand_id,status,post_type,hook,scheduled_for")
      .in("status", ["approved", "pending_approval"])
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true }),
  ]);

  const brands = (brandRows ?? []) as Brand[];
  const scheduled = (postRows ?? []) as ScheduledPost[];

  const today = startOfDay(new Date());
  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDays(today, i));

  const postsByDay = new Map<string, ScheduledPost[]>();
  for (const p of scheduled) {
    if (!p.scheduled_for) continue;
    const key = format(parseISO(p.scheduled_for), "yyyy-MM-dd");
    const arr = postsByDay.get(key) ?? [];
    arr.push(p);
    postsByDay.set(key, arr);
  }

  const activeBrands = brands.filter((b) => b.mode !== "paused");

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Next 7 days. Recurring slots per brand plus any scheduled posts.
        </p>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No brands yet. Add one in Brands to see its schedule here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-7 divide-x">
            {days.map((day) => {
              const dow = day.getDay();
              const dayKey = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDay.get(dayKey) ?? [];

              const slotsForDay: {
                brand: Brand;
                time: string;
                minutes: number;
              }[] = [];
              for (const b of activeBrands) {
                for (const t of b.posting_times) {
                  slotsForDay.push({
                    brand: b,
                    time: t,
                    minutes: minutesOfDay(t),
                  });
                }
              }
              slotsForDay.sort((a, b) => a.minutes - b.minutes);

              const isToday = dow === new Date().getDay() && day.getDate() === new Date().getDate();

              return (
                <div key={dayKey} className="min-h-80">
                  <div
                    className={
                      "px-3 py-2 border-b text-xs " +
                      (isToday ? "bg-primary/5 font-medium" : "bg-muted/30")
                    }
                  >
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div className="text-sm font-medium">
                      {format(day, "MMM d")}
                    </div>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {slotsForDay.length === 0 && dayPosts.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic px-1 py-2">
                        No slots
                      </p>
                    ) : null}
                    {slotsForDay.map(({ brand, time }, i) => (
                      <div
                        key={`${brand.id}-${time}-${i}`}
                        className="rounded border bg-background p-1.5 text-[11px] space-y-0.5"
                      >
                        <div className="font-mono text-muted-foreground">
                          {time}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-medium">
                            {brand.name}
                          </span>
                          <Badge
                            className={"text-[10px] shrink-0 " + modeColor(brand.mode)}
                          >
                            {brand.mode === "semi_auto" ? "semi" : brand.mode}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {dayPosts.map((p) => (
                      <div
                        key={p.id}
                        className="rounded border border-blue-200 bg-blue-50 p-1.5 text-[11px] space-y-0.5"
                      >
                        <div className="font-mono text-blue-700">
                          {p.scheduled_for
                            ? format(parseISO(p.scheduled_for), "HH:mm")
                            : ""}
                        </div>
                        <div className="text-blue-900 truncate">
                          {p.hook ?? p.post_type}
                        </div>
                        <div className="text-[10px] text-blue-700">
                          {p.status === "pending_approval" ? "pending" : "approved"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border bg-background" />
          Recurring slot
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-blue-200 bg-blue-50" />
          Scheduled post
        </div>
      </div>
    </div>
  );
}
