"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/supply-chain/date-field";
import { PROCUREMENT_METHODS } from "@/lib/supply-chain/validation";
import type {
  Buyer,
  ProcurementMethod,
  SupplyProject,
  Vendor,
} from "@/types";

/** Sentinel for "no vendor" since SelectItem values cannot be empty. */
const NO_VENDOR = "__none__";

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  buyers,
  vendors,
  onSaved,
  onBuyersChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: SupplyProject | null;
  buyers: Buyer[];
  vendors: Vendor[];
  onSaved: () => void;
  /** Called after an inline buyer create so the caller can refresh its list. */
  onBuyersChanged: () => void;
}) {
  const isEdit = Boolean(project);
  const [title, setTitle] = React.useState("");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [buyerId, setBuyerId] = React.useState("");
  const [vendorId, setVendorId] = React.useState(NO_VENDOR);
  const [method, setMethod] = React.useState<ProcurementMethod>(
    "open competitive bidding"
  );
  const [budgetedCost, setBudgetedCost] = React.useState("");
  const [finalCost, setFinalCost] = React.useState("");
  const [currency, setCurrency] = React.useState<"NGN" | "USD">("NGN");
  const [usdValue, setUsdValue] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [nc, setNc] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Inline "new buyer" mini-form.
  const [addingBuyer, setAddingBuyer] = React.useState(false);
  const [buyerName, setBuyerName] = React.useState("");
  const [buyerEmail, setBuyerEmail] = React.useState("");
  const [savingBuyer, setSavingBuyer] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setAddingBuyer(false);
    setBuyerName("");
    setBuyerEmail("");
    setTitle(project?.title ?? "");
    setReferenceNumber(project?.referenceNumber ?? "");
    setDescription(project?.description ?? "");
    setBuyerId(project?.buyerId ?? "");
    setVendorId(project?.vendorId ?? NO_VENDOR);
    setMethod(project?.procurementMethod ?? "open competitive bidding");
    setBudgetedCost(project?.budgetedCost?.toString() ?? "");
    setFinalCost(project?.finalCost?.toString() ?? "");
    setCurrency(project?.currency ?? "NGN");
    setUsdValue(project?.usdValue?.toString() ?? "");
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
    setNc(project?.nigerianContentPercentage?.toString() ?? "");
  }, [open, project]);

  async function createBuyerInline() {
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setError("New buyer needs a name and email.");
      return;
    }
    setSavingBuyer(true);
    setError(null);
    try {
      const res = await fetch("/api/supply-chain/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: buyerName.trim(),
          email: buyerEmail.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        buyer?: Buyer;
        error?: string;
      };
      if (!res.ok || !data.buyer) throw new Error(data.error ?? "Failed.");
      toast.success(`Buyer ${data.buyer.fullName} added.`);
      onBuyersChanged();
      setBuyerId(data.buyer.id);
      setAddingBuyer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the buyer.");
    } finally {
      setSavingBuyer(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (!referenceNumber.trim()) return setError("Reference number is required.");
    if (!buyerId) return setError("Pick the buyer handling this project.");
    if (!budgetedCost || Number(budgetedCost) < 0) {
      return setError("Budgeted cost is required.");
    }
    if (!startDate || !endDate) {
      return setError("Start and planned end dates are required.");
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/supply-chain/projects/${project!.id}`
        : "/api/supply-chain/projects";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          referenceNumber: referenceNumber.trim(),
          description: description.trim() || undefined,
          buyerId,
          vendorId: vendorId === NO_VENDOR ? undefined : vendorId,
          procurementMethod: method,
          budgetedCost: Number(budgetedCost),
          finalCost: finalCost === "" ? undefined : Number(finalCost),
          currency,
          usdValue: usdValue === "" ? undefined : Number(usdValue),
          startDate,
          endDate,
          actualCompletionDate: project?.actualCompletionDate,
          nigerianContentPercentage: nc === "" ? undefined : Number(nc),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed.");
      }
      toast.success(isEdit ? "Project updated." : "Project created.");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project's details. Status changes are made from the project page."
              : "New projects start as ongoing. A vendor can be assigned now or later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-title">Title</Label>
              <Input
                id="p-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wellhead maintenance services — OML 29"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-ref">Reference number</Label>
              <Input
                id="p-ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. NG-PROC-2026-014"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-method">Procurement method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as ProcurementMethod)}
              >
                <SelectTrigger id="p-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCUREMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">Description (optional)</Label>
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="p-buyer">Buyer</Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  onClick={() => setAddingBuyer((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                  New buyer
                </button>
              </div>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger id="p-buyer">
                  <SelectValue placeholder="Select the buyer" />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-vendor">Vendor (optional)</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger id="p-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENDOR}>Unassigned</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {addingBuyer && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Add a buyer</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Full name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={createBuyerInline}
                  disabled={savingBuyer}
                >
                  {savingBuyer ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-budget">Budgeted cost (₦)</Label>
              <Input
                id="p-budget"
                type="number"
                min={0}
                value={budgetedCost}
                onChange={(e) => setBudgetedCost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-final">Final cost (₦, optional)</Label>
              <Input
                id="p-final"
                type="number"
                min={0}
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                placeholder="Awarded value"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-nc">Nigerian content %</Label>
              <Input
                id="p-nc"
                type="number"
                min={0}
                max={100}
                value={nc}
                onChange={(e) => setNc(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as "NGN" | "USD")}
              >
                <SelectTrigger id="p-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN (₦)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-usd">USD value (optional)</Label>
              <Input
                id="p-usd"
                type="number"
                min={0}
                value={usdValue}
                onChange={(e) => setUsdValue(e.target.value)}
                placeholder="Dollar value when quoted in USD"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Start date" value={startDate} onChange={setStartDate} />
            <DateField label="Planned end date" value={endDate} onChange={setEndDate} />
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
