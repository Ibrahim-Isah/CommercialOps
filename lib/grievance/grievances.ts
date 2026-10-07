/**
 * Grievance register + case workflow persistence (Supabase).
 *
 * Implements the end-to-end grievance process of OPI SXD 001/OERNL r01:
 * cases are registered (Annex A.3 register), moved through the process
 * ladder (Figure 1), resolved via the documented resolution levels, and
 * closed out — every action lands in grievance_events (§7 traceability).
 */
import { getSupabase } from "@/lib/supabase";
import { fail, isInvalidInput, isUniqueViolation } from "@/lib/grievance/common";
import { StoreError } from "@/lib/store";
import type {
  Grievance,
  GrievanceClosureType,
  GrievanceEvent,
  GrievanceEventType,
  GrievanceInput,
  GrievanceResolutionType,
  GrievanceStatus,
  GrievanceStep,
} from "@/types";

interface GrievanceRow {
  id: string;
  reference_number: string;
  title: string;
  description: string | null;
  category: Grievance["category"];
  nature: Grievance["nature"];
  severity: Grievance["severity"];
  human_rights_related: boolean;
  sensitive: boolean;
  complainant_name: string;
  complainant_type: Grievance["complainantType"];
  complainant_contact: string | null;
  stakeholder_group: string | null;
  state: string | null;
  lga: string | null;
  community: string | null;
  area: Grievance["area"];
  medium: Grievance["medium"];
  date_of_complaint: string;
  date_received: string;
  registering_officer: string;
  documentation: string | null;
  responsible_department: string | null;
  responsible_person: string | null;
  action_to_be_done: string | null;
  target_resolution_date: string | null;
  rapid_response: boolean;
  litigation: boolean;
  step: GrievanceStep;
  status: GrievanceStatus;
  resolution_type: GrievanceResolutionType | null;
  resolution_notes: string | null;
  resolved_date: string | null;
  closure_type: GrievanceClosureType | null;
  closure_notes: string | null;
  closed_date: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  grievance_id: string;
  type: GrievanceEventType;
  note: string | null;
  actor: string | null;
  created_at: string;
}

function rowToGrievance(row: GrievanceRow): Grievance {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category,
    nature: row.nature,
    severity: row.severity,
    humanRightsRelated: row.human_rights_related,
    sensitive: row.sensitive,
    complainantName: row.complainant_name,
    complainantType: row.complainant_type,
    complainantContact: row.complainant_contact ?? undefined,
    stakeholderGroup: row.stakeholder_group ?? undefined,
    state: row.state ?? undefined,
    lga: row.lga ?? undefined,
    community: row.community ?? undefined,
    area: row.area,
    medium: row.medium,
    dateOfComplaint: row.date_of_complaint,
    dateReceived: row.date_received,
    registeringOfficer: row.registering_officer,
    documentation: row.documentation ?? undefined,
    responsibleDepartment: row.responsible_department ?? undefined,
    responsiblePerson: row.responsible_person ?? undefined,
    actionRequired: row.action_to_be_done ?? undefined,
    targetResolutionDate: row.target_resolution_date ?? undefined,
    rapidResponse: row.rapid_response,
    litigation: row.litigation,
    step: row.step,
    status: row.status,
    resolutionType: row.resolution_type ?? undefined,
    resolutionNotes: row.resolution_notes ?? undefined,
    resolvedDate: row.resolved_date ?? undefined,
    closureType: row.closure_type ?? undefined,
    closureNotes: row.closure_notes ?? undefined,
    closedDate: row.closed_date ?? undefined,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputToRow(input: GrievanceInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    nature: input.nature,
    severity: input.severity,
    human_rights_related: input.humanRightsRelated,
    sensitive: input.sensitive,
    complainant_name: input.complainantName,
    complainant_type: input.complainantType,
    complainant_contact: input.complainantContact ?? null,
    stakeholder_group: input.stakeholderGroup ?? null,
    state: input.state ?? null,
    lga: input.lga ?? null,
    community: input.community ?? null,
    area: input.area,
    medium: input.medium,
    date_of_complaint: input.dateOfComplaint,
    date_received: input.dateReceived,
    registering_officer: input.registeringOfficer,
    documentation: input.documentation ?? null,
    responsible_department: input.responsibleDepartment ?? null,
    responsible_person: input.responsiblePerson ?? null,
    action_to_be_done: input.actionRequired ?? null,
    target_resolution_date: input.targetResolutionDate ?? null,
    remarks: input.remarks ?? null,
  };
}

function rowToEvent(row: EventRow): GrievanceEvent {
  return {
    id: row.id,
    grievanceId: row.grievance_id,
    type: row.type,
    note: row.note ?? undefined,
    actor: row.actor ?? undefined,
    createdAt: row.created_at,
  };
}

/** Register serial number: GRV-<year>-<sequence within the year>. */
async function nextReferenceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GRV-${year}-`;
  const { data, error } = await getSupabase()
    .from("grievances")
    .select("reference_number")
    .like("reference_number", `${prefix}%`)
    .order("reference_number", { ascending: false })
    .limit(1);
  if (error) fail("read the grievance register", error);
  const last = (data ?? [])[0]?.reference_number as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function recordEvent(
  grievanceId: string,
  type: GrievanceEventType,
  note?: string,
  actor?: string
): Promise<void> {
  const { error } = await getSupabase().from("grievance_events").insert({
    grievance_id: grievanceId,
    type,
    note: note?.trim() || null,
    actor: actor?.trim() || null,
  });
  if (error) fail("record the grievance event", error);
}

// --- Register ----------------------------------------------------------------

export async function listGrievances(): Promise<Grievance[]> {
  const { data, error } = await getSupabase()
    .from("grievances")
    .select("*")
    .order("date_received", { ascending: false })
    .order("reference_number", { ascending: false });
  if (error) fail("load grievances", error);
  return (data as unknown as GrievanceRow[]).map(rowToGrievance);
}

/**
 * Register a grievance. Opens the audit trail with the registration event,
 * and automatically logs acknowledgement/assignment when the form already
 * carried those details (channel receipt + assigned owner).
 */
export async function createGrievance(input: GrievanceInput): Promise<Grievance> {
  const sb = getSupabase();
  const referenceNumber = await nextReferenceNumber();

  const { data, error } = await sb
    .from("grievances")
    .insert({ ...inputToRow(input), reference_number: referenceNumber })
    .select("*")
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new StoreError(
        "Register clash: another grievance just took that serial number. Try again."
      );
    }
    fail("register the grievance", error);
  }
  const grievance = rowToGrievance(data as unknown as GrievanceRow);

  await recordEvent(
    grievance.id,
    "registered",
    `Grievance received via ${grievance.medium} and registered.`,
    grievance.registeringOfficer
  );
  return grievance;
}

export async function getGrievance(id: string): Promise<
  { grievance: Grievance; events: GrievanceEvent[] } | null
> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("grievances")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return null;
    fail("load the grievance", error);
  }
  if (!data) return null;

  const { data: events, error: eventError } = await sb
    .from("grievance_events")
    .select("*")
    .eq("grievance_id", id)
    .order("created_at", { ascending: false });
  if (eventError) fail("load the grievance history", eventError);

  return {
    grievance: rowToGrievance(data as unknown as GrievanceRow),
    events: (events as unknown as EventRow[]).map(rowToEvent),
  };
}

/** Field updates only — lifecycle transitions go through advanceGrievance. */
export async function updateGrievance(
  id: string,
  input: GrievanceInput
): Promise<Grievance | undefined> {
  const { data, error } = await getSupabase()
    .from("grievances")
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("update the grievance", error);
  }
  return data ? rowToGrievance(data as unknown as GrievanceRow) : undefined;
}

export async function deleteGrievance(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("grievances")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (isInvalidInput(error)) return false;
    fail("delete the grievance", error);
  }
  return (data ?? []).length > 0;
}

// --- Case workflow (Figure 1) --------------------------------------------------

export interface AdvanceOptions {
  step?: GrievanceStep;
  status?: GrievanceStatus;
  resolutionType?: GrievanceResolutionType;
  resolutionNotes?: string;
  resolvedDate?: string;
  closureType?: GrievanceClosureType;
  closureNotes?: string;
  closedDate?: string;
  rapidResponse?: boolean;
  litigation?: boolean;
  responsibleDepartment?: string;
  responsiblePerson?: string;
  actionRequired?: string;
  targetResolutionDate?: string;
  note?: string;
  actor?: string;
}

/**
 * Move a case along the grievance process and record the change.
 * The event type is derived from what changed so the audit trail reads as
 * the process history (registered → acknowledged → assigned → … → closure).
 */
export async function advanceGrievance(
  id: string,
  options: AdvanceOptions
): Promise<Grievance | undefined> {
  const sb = getSupabase();
  const { data: existing, error: readError } = await sb
    .from("grievances")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    if (isInvalidInput(readError)) return undefined;
    fail("load the grievance", readError);
  }
  if (!existing) return undefined;
  const current = rowToGrievance(existing as unknown as GrievanceRow);

  // Business rules straight from the OPI: resolving requires how (the
  // resolution level); closing out requires the closure grounds — complainant
  // sign-off, external redress, or abandoned (§6.6).
  const nextStatus = options.status ?? current.status;
  const hasResolution =
    (options.resolutionType ?? current.resolutionType) !== undefined;
  if (nextStatus === "Resolved" && !hasResolution) {
    throw new StoreError(
      "Resolving a grievance requires a resolution type (how it was resolved)."
    );
  }
  const hasClosure = (options.closureType ?? current.closureType) !== undefined;
  if (nextStatus === "Closed" && !hasClosure) {
    throw new StoreError(
      "A grievance is closed when the complainant signs off, opts for external redress, or the case is abandoned — record the closure grounds."
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (options.step) patch.step = options.step;
  if (options.status) patch.status = options.status;
  if (options.resolutionType) patch.resolution_type = options.resolutionType;
  if (options.resolutionNotes !== undefined) {
    patch.resolution_notes = options.resolutionNotes?.trim() || null;
  }
  if (options.resolvedDate) patch.resolved_date = options.resolvedDate;
  if (options.closureType) patch.closure_type = options.closureType;
  if (options.closureNotes !== undefined) {
    patch.closure_notes = options.closureNotes?.trim() || null;
  }
  if (options.closedDate) patch.closed_date = options.closedDate;
  if (options.rapidResponse !== undefined) patch.rapid_response = options.rapidResponse;
  if (options.litigation !== undefined) patch.litigation = options.litigation;
  if (options.responsibleDepartment !== undefined) {
    patch.responsible_department = options.responsibleDepartment?.trim() || null;
  }
  if (options.responsiblePerson !== undefined) {
    patch.responsible_person = options.responsiblePerson?.trim() || null;
  }
  if (options.actionRequired !== undefined) {
    patch.action_to_be_done = options.actionRequired?.trim() || null;
  }
  if (options.targetResolutionDate !== undefined) {
    patch.target_resolution_date = options.targetResolutionDate || null;
  }

  const { data, error } = await sb
    .from("grievances")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("update the grievance", error);

  // Derive the audit-trail event type from the change itself.
  let type: GrievanceEventType = "note";
  if (options.closureType || options.status === "Closed" || options.status === "Abandoned") {
    type = "closure";
  } else if (options.resolutionType || options.status === "Resolved") {
    type = "resolution";
  } else if (options.step && options.step !== current.step) {
    if (options.step === "Acknowledge") type = "acknowledged";
    else if (options.step === "Assess & Assign") type = "assigned";
    else if (options.step === "Respond") type = "response";
    else type = "step-change";
  } else if (options.responsiblePerson && options.responsiblePerson !== current.responsiblePerson) {
    type = "assigned";
  }

  await recordEvent(id, type, options.note, options.actor);
  return rowToGrievance(data as unknown as GrievanceRow);
}

/** Log engagement activity on a case without changing its lifecycle. */
export async function logGrievanceEvent(
  id: string,
  type: GrievanceEventType,
  note?: string,
  actor?: string
): Promise<GrievanceEvent | null> {
  const sb = getSupabase();
  const { data: exists } = await sb
    .from("grievances")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!exists) return null;

  const { data, error } = await sb
    .from("grievance_events")
    .insert({
      grievance_id: id,
      type,
      note: note?.trim() || null,
      actor: actor?.trim() || null,
    })
    .select("*")
    .single();
  if (error) fail("record the grievance event", error);
  return rowToEvent(data as unknown as EventRow);
}
