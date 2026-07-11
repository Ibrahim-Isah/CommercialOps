"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Buyer } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BuyerDialog({
  open,
  onOpenChange,
  buyer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer?: Buyer | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(buyer);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setFullName(buyer?.fullName ?? "");
    setEmail(buyer?.email ?? "");
  }, [open, buyer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return setError("Full name is required.");
    if (!EMAIL_RE.test(email.trim())) return setError("A valid email is required.");
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/supply-chain/buyers/${buyer!.id}`
        : "/api/supply-chain/buyers";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed.");
      }
      toast.success(isEdit ? "Buyer updated." : "Buyer created.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit buyer" : "New buyer"}</DialogTitle>
          <DialogDescription>
            A procurement staff member who manages projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Full name</Label>
            <Input
              id="b-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Amina Bello"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-email">Email</Label>
            <Input
              id="b-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create buyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
