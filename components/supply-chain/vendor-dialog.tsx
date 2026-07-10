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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
} from "@/lib/supply-chain/validation";
import type { Vendor, VendorCategory, VendorStatus } from "@/types";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
  "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ScoreInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={5}
        step={0.1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0–5"
      />
    </div>
  );
}

export function VendorDialog({
  open,
  onOpenChange,
  vendor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(vendor);
  const [name, setName] = React.useState("");
  const [rcNumber, setRcNumber] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [state, setState] = React.useState("");
  const [category, setCategory] = React.useState<VendorCategory>("Other");
  const [equity, setEquity] = React.useState("");
  const [delivery, setDelivery] = React.useState("");
  const [quality, setQuality] = React.useState("");
  const [hse, setHse] = React.useState("");
  const [compliance, setCompliance] = React.useState("");
  const [override, setOverride] = React.useState("");
  const [status, setStatus] = React.useState<VendorStatus>("active");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(vendor?.name ?? "");
    setRcNumber(vendor?.rcNumber ?? "");
    setContactPerson(vendor?.contactPerson ?? "");
    setEmail(vendor?.email ?? "");
    setPhone(vendor?.phone ?? "");
    setAddress(vendor?.address ?? "");
    setState(vendor?.state ?? "");
    setCategory(vendor?.category ?? "Other");
    setEquity(vendor?.nigerianEquityPercentage?.toString() ?? "");
    setDelivery(vendor?.deliveryScore?.toString() ?? "");
    setQuality(vendor?.qualityScore?.toString() ?? "");
    setHse(vendor?.hseScore?.toString() ?? "");
    setCompliance(vendor?.complianceScore?.toString() ?? "");
    setOverride(vendor?.confidenceOverride?.toString() ?? "");
    setStatus(vendor?.status ?? "active");
    setNotes(vendor?.notes ?? "");
  }, [open, vendor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Company name is required.");
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      return setError("Email must be a valid address.");
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/supply-chain/vendors/${vendor!.id}`
        : "/api/supply-chain/vendors";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rcNumber: rcNumber.trim() || undefined,
          contactPerson: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          state: state.trim() || undefined,
          category,
          nigerianEquityPercentage: equity === "" ? undefined : Number(equity),
          deliveryScore: delivery === "" ? undefined : Number(delivery),
          qualityScore: quality === "" ? undefined : Number(quality),
          hseScore: hse === "" ? undefined : Number(hse),
          complianceScore: compliance === "" ? undefined : Number(compliance),
          confidenceOverride: override === "" ? undefined : Number(override),
          status,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed.");
      }
      toast.success(isEdit ? "Vendor updated." : "Vendor created.");
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
          <DialogTitle>{isEdit ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            A contractor or supplier for procurement projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-name">Company name</Label>
              <Input
                id="v-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Delta Offshore Services Ltd"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-rc">RC number (CAC)</Label>
              <Input
                id="v-rc"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                placeholder="e.g. RC1234567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as VendorCategory)}
              >
                <SelectTrigger id="v-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-contact">Contact person</Label>
              <Input
                id="v-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-email">Email</Label>
              <Input
                id="v-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-phone">Phone</Label>
              <Input
                id="v-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-state">State</Label>
              <Input
                id="v-state"
                list="ng-states"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Rivers"
              />
              <datalist id="ng-states">
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-address">Address</Label>
              <Input
                id="v-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-equity">Nigerian equity %</Label>
              <Input
                id="v-equity"
                type="number"
                min={0}
                max={100}
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                placeholder="51+ = indigenous"
              />
            </div>
            {isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="v-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as VendorStatus)}
                >
                  <SelectTrigger id="v-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Performance scores (0–5)
              <span className="ml-1 font-normal text-muted-foreground">
                — combine into the confidence rating
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-5">
              <ScoreInput id="v-delivery" label="Delivery" value={delivery} onChange={setDelivery} />
              <ScoreInput id="v-quality" label="Quality" value={quality} onChange={setQuality} />
              <ScoreInput id="v-hse" label="HSE" value={hse} onChange={setHse} />
              <ScoreInput id="v-compliance" label="Compliance" value={compliance} onChange={setCompliance} />
              <ScoreInput id="v-override" label="Override" value={override} onChange={setOverride} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-notes">Notes (optional)</Label>
            <Textarea
              id="v-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
