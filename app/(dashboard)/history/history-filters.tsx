"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type BrandOpt = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "all", label: "All history" },
  { value: "posted", label: "Posted" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
];

export function HistoryFilters({ brands }: { brands: BrandOpt[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentStatus = params.get("status") ?? "all";
  const currentBrand = params.get("brand") ?? "all";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `/history?${qs}` : "/history");
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Status</Label>
        <Select
          value={currentStatus}
          onValueChange={(v) => update("status", v ?? "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Brand</Label>
        <Select
          value={currentBrand}
          onValueChange={(v) => update("brand", v ?? "all")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
