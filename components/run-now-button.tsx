"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  brandId?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
};

export function RunNowButton({ brandId, label, variant = "outline" }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          force: brandId ? true : false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Trigger failed");
        return;
      }
      const summary = json.summary as {
        checkedBrands: number;
        dueBrands: number;
        results: { brand_name: string; outcome: { status: string; error?: string } }[];
      };
      const done = summary.results
        .map((r) => `${r.brand_name}: ${r.outcome.status}${r.outcome.status === "failed" ? " — " + (r.outcome as { error?: string }).error : ""}`)
        .join(" · ");
      toast.success(
        `Checked ${summary.checkedBrands}, due ${summary.dueBrands}. ${done || "nothing ran."}`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant={variant}>
      {loading ? "Running…" : (label ?? (brandId ? "Generate now" : "Run pipeline"))}
    </Button>
  );
}
