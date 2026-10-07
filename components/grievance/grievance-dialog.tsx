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
import { DateField } from "@/components/supply-chain/date-field";
import {
  GRIEVANCE_AREAS,
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_CHANNELS,
  GRIEVANCE_COMPLAINANT_TYPES,
  GRIEVANCE_NATURES,
  GRIEVANCE_SEVERITIES,
} from "@/lib/grievance/validation";
import type {
  GrievanceArea,
  GrievanceCategory,
  GrievanceChannel,
  GrievanceComplainantType,
  GrievanceInput,
  GrievanceNature,
  GrievanceSeverity,
  GrievanceWithMeta,
} from "@/types";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {hint && (
          <span className="ml-1 font-normal text-muted-foreground">({hint})</span>
        )}
      </Label>
      {children}
    </div>
  );
}

/**
 * Registration form for a grievance (Phase 1: Receive & Register, §6.6).
 * Columns follow the Annex A.3 Grievance Register so the on-screen form and
 * the official register stay in step.
 */
export function GrievanceDialog({
  open,
  onOpenChange,
  grievance,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits the existing case; otherwise registers a new one. */
  grievance?: GrievanceWithMeta | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(grievance);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<GrievanceCategory | "">("");
  const [nature, setNature] = React.useState<GrievanceNature | "">("");
  const [severity, setSeverity] = React.useState<GrievanceSeverity>("Low");
  const [humanRightsRelated, setHumanRightsRelated] = React.useState(false);
  const [sensitive, setSensitive] = React.useState(false);

  const [complainantName, setComplainantName] = React.useState("");
  const [complainantType, setComplainantType] =
    React.useState<GrievanceComplainantType>("Individual");
  const [complainantContact, setComplainantContact] = React.useState("");
  const [stakeholderGroup, setStakeholderGroup] = React.useState("");

  const [state, setState] = React.useState("");
  const [lga, setLga] = React.useState("");
  const [community, setCommunity] = React.useState("");
  const [area, setArea] = React.useState<GrievanceArea | "">("");
  const [medium, setMedium] = React.useState<GrievanceChannel | "">("");

  const [dateOfComplaint, setDateOfComplaint] = React.useState("");
  const [dateReceived, setDateReceived] = React.useState("");
  const [registeringOfficer, setRegisteringOfficer] = React.useState("");
  const [documentation, setDocumentation] = React.useState("");

  const [responsibleDepartment, setResponsibleDepartment] = React.useState("");
  const [responsiblePerson, setResponsiblePerson] = React.useState("");
  const [actionRequired, setActionRequired] = React.useState("");
  const [targetResolutionDate, setTargetResolutionDate] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(grievance?.title ?? "");
    setDescription(grievance?.description ?? "");
    setCategory(grievance?.category ?? "");
    setNature(grievance?.nature ?? "");
    setSeverity(grievance?.severity ?? "Low");
    setHumanRightsRelated(grievance?.humanRightsRelated ?? false);
    setSensitive(grievance?.sensitive ?? false);
    setComplainantName(grievance?.complainantName ?? "");
    setComplainantType(grievance?.complainantType ?? "Individual");
    setComplainantContact(grievance?.complainantContact ?? "");
    setStakeholderGroup(grievance?.stakeholderGroup ?? "");
    setState(grievance?.state ?? "");
    setLga(grievance?.lga ?? "");
    setCommunity(grievance?.community ?? "");
    setArea(grievance?.area ?? "");
    setMedium(grievance?.medium ?? "");
    setDateOfComplaint(grievance?.dateOfComplaint ?? "");
    setDateReceived(grievance?.dateReceived ?? "");
    setRegisteringOfficer(grievance?.registeringOfficer ?? "");
    setDocumentation(grievance?.documentation ?? "");
    setResponsibleDepartment(grievance?.responsibleDepartment ?? "");
    setResponsiblePerson(grievance?.responsiblePerson ?? "");
    setActionRequired(grievance?.actionRequired ?? "");
    setTargetResolutionDate(grievance?.targetResolutionDate ?? "");
    setRemarks(grievance?.remarks ?? "");
  }, [open, grievance]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return setError("Pick the area of concern (category).");
    if (!nature) return setError("Pick the nature of the complaint.");
    if (!area) return setError("Pick the operational area where it was received.");
    if (!medium) return setError("Pick the channel the grievance came through.");

    setSaving(true);
    setError(null);
    const payload: GrievanceInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      nature,
      severity,
      humanRightsRelated,
      sensitive,
      complainantName: complainantName.trim(),
      complainantType,
      complainantContact: complainantContact.trim() || undefined,
      stakeholderGroup: stakeholderGroup.trim() || undefined,
      state: state.trim() || undefined,
      lga: lga.trim() || undefined,
      community: community.trim() || undefined,
      area,
      medium,
      dateOfComplaint,
      dateReceived,
      registeringOfficer: registeringOfficer.trim(),
      documentation: documentation.trim() || undefined,
      responsibleDepartment: responsibleDepartment.trim() || undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      actionRequired: actionRequired.trim() || undefined,
      targetResolutionDate: targetResolutionDate || undefined,
      remarks: remarks.trim() || undefined,
    };
    try {
      const res = await fetch(
        grievance ? `/api/grievances/${grievance.id}` : "/api/grievances",
        {
          method: grievance ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Saving failed.");
      toast.success(
        grievance ? "Grievance updated." : "Grievance registered in the Grievance Register."
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit grievance" : "Register a grievance"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the registration record. Workflow changes are made from the case page."
              : "Receive & Register (Phase 1): capture the complaint regardless of channel and log it in the Grievance Register."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary, e.g. Crude spill affecting farmland at Ogale"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as GrievanceCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Area of concern" />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nature of complaint">
              <Select value={nature} onValueChange={(v) => setNature(v as GrievanceNature)}>
                <SelectTrigger>
                  <SelectValue placeholder="Register nature" />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_NATURES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description" hint="optional">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, who is affected, and the impact claimed."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Severity">
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as GrievanceSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={humanRightsRelated}
                  onChange={(e) => setHumanRightsRelated(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Human-rights related
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sensitive}
                  onChange={(e) => setSensitive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Sensitive
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name of complainant">
              <Input
                value={complainantName}
                onChange={(e) => setComplainantName(e.target.value)}
                placeholder="Individual, group or community name"
              />
            </Field>
            <Field label="Complainant type">
              <Select
                value={complainantType}
                onValueChange={(v) => setComplainantType(v as GrievanceComplainantType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_COMPLAINANT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact" hint="phone, email…">
              <Input
                value={complainantContact}
                onChange={(e) => setComplainantContact(e.target.value)}
              />
            </Field>
            <Field label="Stakeholder group" hint="CDC, women's group…">
              <Input
                value={stakeholderGroup}
                onChange={(e) => setStakeholderGroup(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="State">
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </Field>
            <Field label="LGA">
              <Input value={lga} onChange={(e) => setLga(e.target.value)} />
            </Field>
            <Field label="Community">
              <Input
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operational area">
              <Select value={area} onValueChange={(v) => setArea(v as GrievanceArea)}>
                <SelectTrigger>
                  <SelectValue placeholder="Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Medium of receipt">
              <Select
                value={medium}
                onValueChange={(v) => setMedium(v as GrievanceChannel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  {GRIEVANCE_CHANNELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DateField
              label="Date of complaint"
              value={dateOfComplaint}
              onChange={setDateOfComplaint}
            />
            <DateField
              label="Date of receipt"
              value={dateReceived}
              onChange={setDateReceived}
            />
            <Field label="Registering officer">
              <Input
                value={registeringOfficer}
                onChange={(e) => setRegisteringOfficer(e.target.value)}
                placeholder="GO / CRO name"
              />
            </Field>
          </div>

          <Field label="Attached documentation" hint="optional">
            <Input
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder="Letters, photos, stamped copies…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsible department">
              <Input
                value={responsibleDepartment}
                onChange={(e) => setResponsibleDepartment(e.target.value)}
                placeholder="Action Department"
              />
            </Field>
            <Field label="Responsible person">
              <Input
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="Grievance Owner"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Action to be done" hint="optional">
              <Input
                value={actionRequired}
                onChange={(e) => setActionRequired(e.target.value)}
                placeholder="Planned corrective action"
              />
            </Field>
            <DateField
              label="Target resolution date"
              value={targetResolutionDate}
              onChange={setTargetResolutionDate}
              optional
            />
          </div>

          <Field label="Remarks" hint="optional">
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Field>

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
              {saving
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Register grievance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
