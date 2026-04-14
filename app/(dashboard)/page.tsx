import { RunNowButton } from "@/components/run-now-button";

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent runs every 5 minutes via pg_cron. Use the button to kick it off manually.
          </p>
        </div>
        <RunNowButton label="Run pipeline now" variant="default" />
      </div>

      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Open <strong>Brands</strong> to configure a brand, set posting times,
        and pick a mode (<code>auto</code>, <code>semi_auto</code>, or{" "}
        <code>paused</code>). Generated posts land in <strong>Content queue</strong>{" "}
        (semi-auto) or go straight to <strong>Post history</strong> (auto).
      </div>
    </div>
  );
}
