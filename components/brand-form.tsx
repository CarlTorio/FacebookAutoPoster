"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import type { z } from "zod";

import { brandInputSchema } from "@/lib/db/schemas";

type BrandInput = z.input<typeof brandInputSchema>;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

type Mode = "create" | "edit";

const DEFAULT_POST_MIX = { text_only: 0.4, text_with_image: 0.4, carousel: 0.2 };

const EMPTY_BRAND: BrandInput = {
  name: "",
  niche: "",
  tone_description: "",
  signature_phrase: "",
  banned_words: [],
  target_audience: "",
  fb_page_id: "",
  fb_page_name: "",
  posting_times: [],
  timezone: "Asia/Manila",
  post_mix: DEFAULT_POST_MIX,
  mode: "paused",
};

export function BrandForm({
  mode,
  brandId,
  defaultValues,
}: {
  mode: Mode;
  brandId?: string;
  defaultValues?: Partial<BrandInput>;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const form = useForm<BrandInput>({
    resolver: zodResolver(brandInputSchema),
    defaultValues: { ...EMPTY_BRAND, ...defaultValues },
  });

  const [bannedInput, setBannedInput] = useState("");
  const [timeInput, setTimeInput] = useState("");

  const bannedWords = form.watch("banned_words") ?? [];
  const postingTimes = form.watch("posting_times") ?? [];
  const postMix = form.watch("post_mix");
  const mixSum =
    (postMix?.text_only ?? 0) +
    (postMix?.text_with_image ?? 0) +
    (postMix?.carousel ?? 0);
  const mixValid = Math.abs(mixSum - 1) < 0.001;

  const addBanned = () => {
    const v = bannedInput.trim();
    if (!v) return;
    if (bannedWords.includes(v)) return;
    form.setValue("banned_words", [...bannedWords, v], { shouldDirty: true });
    setBannedInput("");
  };

  const removeBanned = (w: string) => {
    form.setValue(
      "banned_words",
      bannedWords.filter((x) => x !== w),
      { shouldDirty: true },
    );
  };

  const addTime = () => {
    const v = timeInput.trim();
    if (!/^\d{2}:\d{2}$/.test(v)) {
      toast.error("Use HH:MM 24-hour format, e.g. 09:30");
      return;
    }
    if (postingTimes.includes(v)) return;
    form.setValue(
      "posting_times",
      [...postingTimes, v].sort(),
      { shouldDirty: true },
    );
    setTimeInput("");
  };

  const removeTime = (t: string) => {
    form.setValue(
      "posting_times",
      postingTimes.filter((x) => x !== t),
      { shouldDirty: true },
    );
  };

  const onSubmit = form.handleSubmit((values) => {
    startSaving(async () => {
      const url =
        mode === "create" ? "/api/brands" : `/api/brands/${brandId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      toast.success(mode === "create" ? "Brand created" : "Brand saved");
      if (mode === "create" && data.data?.id) {
        router.push(`/brands/${data.data.id}`);
      } else {
        router.refresh();
      }
    });
  });

  const onDelete = () => {
    if (!brandId) return;
    startDeleting(async () => {
      const res = await fetch(`/api/brands/${brandId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Delete failed");
        return;
      }
      toast.success("Brand deleted");
      router.push("/brands");
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
            <CardDescription>
              Identity and voice for this brand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Coffee" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="niche"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niche</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Specialty coffee shop in Manila"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tone_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tone description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Warm, conversational Taglish. Uses second person. Avoids corporate jargon."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="signature_phrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Signature phrase</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Stay caffeinated, stay kind."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target audience</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Working professionals 22–40 in Metro Manila who value quality coffee."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Banned words</CardTitle>
            <CardDescription>
              The content agent will avoid these.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={bannedInput}
                onChange={(e) => setBannedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBanned();
                  }
                }}
                placeholder="Add a word, press Enter"
              />
              <Button type="button" variant="outline" onClick={addBanned}>
                Add
              </Button>
            </div>
            {bannedWords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {bannedWords.map((w) => (
                  <Badge
                    key={w}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() => removeBanned(w)}
                      className="rounded hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remove ${w}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No banned words.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facebook page</CardTitle>
            <CardDescription>
              Which page this brand posts to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="fb_page_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123456789012345"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fb_page_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Acme Coffee PH"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
            <CardDescription>
              Posting times and timezone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Posting times (HH:MM)</Label>
              <div className="flex gap-2">
                <Input
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTime();
                    }
                  }}
                  placeholder="09:30"
                />
                <Button type="button" variant="outline" onClick={addTime}>
                  Add
                </Button>
              </div>
              {postingTimes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {postingTimes.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTime(t)}
                        className="rounded hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`Remove ${t}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No posting times yet.
                </p>
              )}
            </div>
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input placeholder="Asia/Manila" {...field} />
                  </FormControl>
                  <FormDescription>
                    IANA timezone name. Defaults to Asia/Manila.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post mix</CardTitle>
            <CardDescription>
              Probability of each post type. Must sum to 1.0.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="post_mix.text_only"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text only</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="post_mix.text_with_image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text + image</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="post_mix.carousel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carousel</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p
              className={
                "text-xs " +
                (mixValid ? "text-muted-foreground" : "text-destructive")
              }
            >
              Sum: {mixSum.toFixed(2)} {mixValid ? "✓" : "(must be 1.00)"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mode</CardTitle>
            <CardDescription>
              Controls how posts get published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posting mode</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="semi_auto">Semi-auto</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Auto publishes directly. Semi-auto waits for approval.
                    Paused skips this brand.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-2">
          <div>
            {mode === "edit" && brandId ? (
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive"
                    />
                  }
                >
                  Delete brand
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete this brand?</DialogTitle>
                    <DialogDescription>
                      This also deletes all associated posts. This action
                      can&apos;t be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={onDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/brands")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create brand"
                  : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
