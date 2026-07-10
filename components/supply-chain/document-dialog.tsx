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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/supply-chain/date-field";
import { DOCUMENT_TYPES } from "@/lib/supply-chain/validation";
import type { VendorDocument, VendorDocumentType } from "@/types";

export function DocumentDialog({
  open,
  onOpenChange,
  vendorId,
  document: doc,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  document?: VendorDocument | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(doc);
  const [documentType, setDocumentType] =
    React.useState<VendorDocumentType>("Certificate of Incorporation (CAC)");
  const [documentName, setDocumentName] = React.useState("");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [issueDate, setIssueDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setDocumentType(doc?.documentType ?? "Certificate of Incorporation (CAC)");
    setDocumentName(doc?.documentName ?? "");
    setDocumentNumber(doc?.documentNumber ?? "");
    setIssueDate(doc?.issueDate ?? "");
    setExpiryDate(doc?.expiryDate ?? "");
  }, [open, doc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentName.trim()) return setError("Document name is required.");
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("documentType", documentType);
      form.set("documentName", documentName.trim());
      if (documentNumber.trim()) form.set("documentNumber", documentNumber.trim());
      if (issueDate) form.set("issueDate", issueDate);
      if (expiryDate) form.set("expiryDate", expiryDate);
      if (file) form.set("file", file);
      if (isEdit) form.set("vendorId", vendorId);

      const url = isEdit
        ? `/api/supply-chain/documents/${doc!.id}`
        : `/api/supply-chain/vendors/${vendorId}/documents`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed.");
      }
      toast.success(isEdit ? "Document updated." : "Document added.");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit document" : "Add document"}</DialogTitle>
          <DialogDescription>
            A permit, certificate or clearance held by this vendor. Documents
            with an expiry date are tracked for renewal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="d-type">Document type</Label>
            <Select
              value={documentType}
              onValueChange={(v) => setDocumentType(v as VendorDocumentType)}
            >
              <SelectTrigger id="d-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">Document name</Label>
              <Input
                id="d-name"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g. NIPEX JQS Certificate 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-number">Document number (optional)</Label>
              <Input
                id="d-number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Issue date" value={issueDate} onChange={setIssueDate} optional />
            <DateField label="Expiry date" value={expiryDate} onChange={setExpiryDate} optional />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-file">
              File{" "}
              <span className="font-normal text-muted-foreground">
                (optional{isEdit ? ", replaces the current file" : ""})
              </span>
            </Label>
            <Input
              id="d-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
