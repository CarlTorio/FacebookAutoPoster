import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Brand } from "@/lib/db/types";

function ModeBadge({ mode }: { mode: Brand["mode"] }) {
  if (mode === "auto")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Auto
      </Badge>
    );
  if (mode === "semi_auto")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
        Semi-auto
      </Badge>
    );
  return <Badge variant="outline">Paused</Badge>;
}

export default async function BrandsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });

  const brands = (data ?? []) as Brand[];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the brands this system posts for.
          </p>
        </div>
        <Button render={<Link href="/brands/new" />}>New brand</Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load brands: {error.message}
        </p>
      ) : brands.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No brands yet. Create your first one to get started.
          </p>
          <Button className="mt-4" render={<Link href="/brands/new" />}>
            Create a brand
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Posting times</TableHead>
                <TableHead>FB page</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    <ModeBadge mode={b.mode} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.posting_times.length} / day
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.fb_page_name ?? b.fb_page_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(b.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/brands/${b.id}`} />}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
