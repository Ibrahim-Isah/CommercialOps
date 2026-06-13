"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type {
  CertificateCategory,
  CertificateInput,
  CertificateWithStatus,
} from "@/types";

const CATEGORIES: CertificateCategory[] = [
  "Regulatory",
  "Operational",
  "Insurance",
  "Vessel",
  "Environmental",
  "Other",
];

const ISSUER_SUGGESTIONS = [
  "NUPRC",
  "NMDPRA",
  "NESS",
  "Nigerian Customs",
  "NIMASA",
  "Insurer",
];

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "d MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(d) => {
              if (d) onChange(toISO(d));
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CertDialog({
  open,
  onOpenChange,
  certificate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate?: CertificateWithStatus | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(certificate);
  const [name, setName] = React.useState("");
  const [issuingBody, setIssuingBody] = React.useState("");
  const [category, setCategory] =
    React.useState<CertificateCategory>("Regulatory");
  const [registrationDate, setRegistrationDate] = React.useState("");
  const [expirationDate, setExpirationDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset / hydrate the form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (certificate) {
      setName(certificate.name);
      setIssuingBody(certificate.issuingBody);
      setCategory(certificate.category);
      setRegistrationDate(certificate.registrationDate);
      setExpirationDate(certificate.expirationDate);
      setNotes(certificate.notes ?? "");
    } else {
      setName("");
      setIssuingBody("");
      setCategory("Regulatory");
      setRegistrationDate("");
      setExpirationDate("");
      setNotes("");
    }
  }, [open, certificate]);

  function validate(): CertificateInput | null {
    if (!name.trim()) return setError("Please enter a name."), null;
    if (!issuingBody.trim())
      return setError("Please enter an issuing body."), null;
    if (!registrationDate)
      return setError("Please pick a registration date."), null;
    if (!expirationDate)
      return setError("Please pick an expiration date."), null;
    if (new Date(expirationDate) <= new Date(registrationDate)) {
      return (
        setError("Expiration date must be after the registration date."), null
      );
    }
    return {
      name: name.trim(),
      issuingBody: issuingBody.trim(),
      category,
      registrationDate,
      expirationDate,
      notes: notes.trim() || undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = validate();
    if (!payload) return;
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/certificates/${certificate!.id}`
        : "/api/certificates";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Save failed.");
      }
      toast.success(isEdit ? "Certificate updated." : "Certificate added.");
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit certificate" : "Add certificate"}
          </DialogTitle>
          <DialogDescription>
            Track a regulatory or operational document and its expiry.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cert-name">Name</Label>
            <Input
              id="cert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NUPRC Crude Oil Export Clearance"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cert-issuer">Issuing body</Label>
              <Input
                id="cert-issuer"
                list="issuer-suggestions"
                value={issuingBody}
                onChange={(e) => setIssuingBody(e.target.value)}
                placeholder="e.g. NUPRC"
                required
              />
              <datalist id="issuer-suggestions">
                {ISSUER_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cert-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as CertificateCategory)}
              >
                <SelectTrigger id="cert-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              label="Registration / issue date"
              value={registrationDate}
              onChange={setRegistrationDate}
            />
            <DateField
              label="Expiration date"
              value={expirationDate}
              onChange={setExpirationDate}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cert-notes">Notes (optional)</Label>
            <Textarea
              id="cert-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra context…"
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add certificate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
