"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function QueueActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const call = async (
    action: "approve" | "reject",
    reasonText?: string,
  ) => {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        action,
        reason: reasonText,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Request failed");
      return false;
    }
    return true;
  };

  const onApprove = () => {
    startTransition(async () => {
      const ok = await call("approve");
      if (ok) {
        toast.success("Post approved");
        router.refresh();
      }
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const ok = await call("reject", reason.trim() || undefined);
      if (ok) {
        toast.success("Post rejected");
        setOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={pending}
            />
          }
        >
          Reject
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this post?</DialogTitle>
            <DialogDescription>
              Optionally note why — helps the agent improve over time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Off-brand tone, wrong topic, etc."
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={onReject}
              disabled={pending}
            >
              {pending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button size="sm" onClick={onApprove} disabled={pending}>
        {pending ? "Working…" : "Approve"}
      </Button>
    </>
  );
}
