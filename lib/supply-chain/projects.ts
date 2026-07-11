/**
 * Buyer + project + status-history persistence (Supabase).
 * Status changes go through changeProjectStatus so every transition lands in
 * project_status_history (the audit trail).
 */
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { fail, isInvalidInput, isUniqueViolation } from "@/lib/supply-chain/common";
import { StoreError } from "@/lib/store";
import type {
  Buyer,
  BuyerActivity,
  BuyerInput,
  BuyerWithStats,
  ProjectStatusChange,
  SupplyProject,
  SupplyProjectInput,
  SupplyProjectStatus,
  SupplyProjectWithRelations,
} from "@/types";

interface ProjectRow {
  id: string;
  title: string;
  reference_number: string;
  description: string | null;
  vendor_id: string | null;
  buyer_id: string;
  status: SupplyProjectStatus;
  procurement_method: SupplyProject["procurementMethod"];
  budgeted_cost_ngn: number | null;
  final_cost_ngn: number | null;
  cost_savings_ngn: number | null;
  budgeted_cost_usd: number | null;
  final_cost_usd: number | null;
  cost_savings_usd: number | null;
  start_date: string;
  end_date: string;
  actual_completion_date: string | null;
  nigerian_content_percentage: number | null;
  created_at: string;
  updated_at: string;
  vendors?: { name: string } | null;
  buyers?: { full_name: string } | null;
}

interface HistoryRow {
  id: string;
  project_id: string;
  old_status: SupplyProjectStatus | null;
  new_status: SupplyProjectStatus;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
  buyers?: { full_name: string } | null;
}

/** A project that sailed past its planned end without being completed. */
function isPastDue(row: ProjectRow, now: Date = new Date()): boolean {
  if (row.status !== "ongoing" && row.status !== "delayed") return false;
  return differenceInCalendarDays(parseISO(row.end_date), now) < 0;
}

function rowToProject(row: ProjectRow): SupplyProjectWithRelations {
  return {
    id: row.id,
    title: row.title,
    referenceNumber: row.reference_number,
    description: row.description ?? undefined,
    vendorId: row.vendor_id ?? undefined,
    buyerId: row.buyer_id,
    status: row.status,
    procurementMethod: row.procurement_method,
    budgetedCostNgn: row.budgeted_cost_ngn ?? undefined,
    finalCostNgn: row.final_cost_ngn ?? undefined,
    costSavingsNgn: row.cost_savings_ngn ?? undefined,
    budgetedCostUsd: row.budgeted_cost_usd ?? undefined,
    finalCostUsd: row.final_cost_usd ?? undefined,
    costSavingsUsd: row.cost_savings_usd ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    actualCompletionDate: row.actual_completion_date ?? undefined,
    nigerianContentPercentage: row.nigerian_content_percentage ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vendorName: row.vendors?.name,
    buyerName: row.buyers?.full_name ?? "Unknown buyer",
    pastDue: isPastDue(row),
  };
}

function inputToRow(input: SupplyProjectInput) {
  return {
    title: input.title,
    reference_number: input.referenceNumber,
    description: input.description ?? null,
    vendor_id: input.vendorId ?? null,
    buyer_id: input.buyerId,
    procurement_method: input.procurementMethod,
    budgeted_cost_ngn: input.budgetedCostNgn ?? null,
    final_cost_ngn: input.finalCostNgn ?? null,
    budgeted_cost_usd: input.budgetedCostUsd ?? null,
    final_cost_usd: input.finalCostUsd ?? null,
    start_date: input.startDate,
    end_date: input.endDate,
    actual_completion_date: input.actualCompletionDate ?? null,
    nigerian_content_percentage: input.nigerianContentPercentage ?? null,
  };
}

const PROJECT_SELECT = "*, vendors(name), buyers(full_name)";

// --- Buyers -------------------------------------------------------------------

export async function listBuyers(): Promise<Buyer[]> {
  const { data, error } = await getSupabase()
    .from("buyers")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) fail("load buyers", error);
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Buyer list with per-buyer project counts and per-currency savings. */
export async function listBuyersWithStats(): Promise<BuyerWithStats[]> {
  const sb = getSupabase();
  const [buyers, projects] = await Promise.all([
    sb.from("buyers").select("*").order("full_name", { ascending: true }),
    sb
      .from("projects")
      .select("buyer_id, status, cost_savings_ngn, cost_savings_usd"),
  ]);
  if (buyers.error) fail("load buyers", buyers.error);
  if (projects.error) fail("load buyer project stats", projects.error);

  const agg = new Map<
    string,
    { projectCount: number; ongoingCount: number; savingsNgn: number; savingsUsd: number }
  >();
  for (const p of projects.data as Array<{
    buyer_id: string;
    status: SupplyProjectStatus;
    cost_savings_ngn: number | null;
    cost_savings_usd: number | null;
  }>) {
    const a =
      agg.get(p.buyer_id) ??
      { projectCount: 0, ongoingCount: 0, savingsNgn: 0, savingsUsd: 0 };
    a.projectCount += 1;
    if (p.status === "ongoing" || p.status === "delayed") a.ongoingCount += 1;
    a.savingsNgn += p.cost_savings_ngn ?? 0;
    a.savingsUsd += p.cost_savings_usd ?? 0;
    agg.set(p.buyer_id, a);
  }

  return (buyers.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(agg.get(row.id) ??
      { projectCount: 0, ongoingCount: 0, savingsNgn: 0, savingsUsd: 0 }),
  }));
}

/** Buyer + the projects they handle + their recent audit-trail activity. */
export async function getBuyer(id: string): Promise<
  | {
      buyer: Buyer;
      projects: SupplyProjectWithRelations[];
      activity: BuyerActivity[];
    }
  | null
> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("buyers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return null;
    fail("load the buyer", error);
  }
  if (!data) return null;

  const [projects, activity] = await Promise.all([
    sb
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("buyer_id", id)
      .order("created_at", { ascending: false }),
    sb
      .from("project_status_history")
      .select("*, projects(title)")
      .eq("changed_by", id)
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);
  if (projects.error) fail("load the buyer's projects", projects.error);
  if (activity.error) fail("load the buyer's activity", activity.error);

  return {
    buyer: {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    projects: (projects.data as unknown as ProjectRow[]).map(rowToProject),
    activity: (
      activity.data as unknown as Array<
        HistoryRow & { projects?: { title: string } | null }
      >
    ).map((h) => ({
      id: h.id,
      projectId: h.project_id,
      projectTitle: h.projects?.title ?? "Deleted project",
      oldStatus: h.old_status ?? undefined,
      newStatus: h.new_status,
      changedAt: h.changed_at,
      note: h.note ?? undefined,
    })),
  };
}

export async function updateBuyer(
  id: string,
  input: BuyerInput
): Promise<Buyer | undefined> {
  const { data, error } = await getSupabase()
    .from("buyers")
    .update({
      full_name: input.fullName,
      email: input.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    if (isUniqueViolation(error)) {
      throw new StoreError("A buyer with that email already exists.");
    }
    fail("update the buyer", error);
  }
  return data
    ? {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    : undefined;
}

/**
 * Deleting a buyer who handles projects is blocked — the safer behaviour:
 * projects must keep an accountable buyer, so reassign them first.
 */
export async function deleteBuyer(
  id: string
): Promise<"deleted" | "blocked" | "notfound"> {
  const sb = getSupabase();
  const owned = await sb
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", id);
  if (owned.error) {
    if (isInvalidInput(owned.error)) return "notfound";
    fail("check the buyer's projects", owned.error);
  }
  if ((owned.count ?? 0) > 0) return "blocked";

  const { data, error } = await sb
    .from("buyers")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) fail("delete the buyer", error);
  return (data ?? []).length > 0 ? "deleted" : "notfound";
}

export async function createBuyer(input: BuyerInput): Promise<Buyer> {
  const { data, error } = await getSupabase()
    .from("buyers")
    .insert({ full_name: input.fullName, email: input.email })
    .select("*")
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new StoreError("A buyer with that email already exists.");
    }
    fail("create the buyer", error);
  }
  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// --- Projects -----------------------------------------------------------------

export async function listProjects(): Promise<SupplyProjectWithRelations[]> {
  const { data, error } = await getSupabase()
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });
  if (error) fail("load projects", error);
  return (data as unknown as ProjectRow[]).map(rowToProject);
}

export async function createProject(
  input: SupplyProjectInput
): Promise<SupplyProjectWithRelations> {
  const sb = getSupabase();
  const status = input.status ?? "ongoing";
  const { data, error } = await sb
    .from("projects")
    .insert({ ...inputToRow(input), status })
    .select(PROJECT_SELECT)
    .single();
  if (error) fail("create the project", error);
  const project = rowToProject(data as unknown as ProjectRow);

  // Open the audit trail with the initial status. Non-fatal if it fails.
  await sb.from("project_status_history").insert({
    project_id: project.id,
    old_status: null,
    new_status: status,
    changed_by: project.buyerId,
    note: "Project created",
  });
  return project;
}

export async function getProject(id: string): Promise<
  | {
      project: SupplyProjectWithRelations;
      history: ProjectStatusChange[];
    }
  | null
> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return null;
    fail("load the project", error);
  }
  if (!data) return null;

  const history = await sb
    .from("project_status_history")
    .select("*, buyers:changed_by(full_name)")
    .eq("project_id", id)
    .order("changed_at", { ascending: false });
  if (history.error) fail("load the status history", history.error);

  return {
    project: rowToProject(data as unknown as ProjectRow),
    history: (history.data as unknown as HistoryRow[]).map((h) => ({
      id: h.id,
      projectId: h.project_id,
      oldStatus: h.old_status ?? undefined,
      newStatus: h.new_status,
      changedBy: h.changed_by ?? undefined,
      changedByName: h.buyers?.full_name,
      changedAt: h.changed_at,
      note: h.note ?? undefined,
    })),
  };
}

/** Field updates only — status transitions go through changeProjectStatus. */
export async function updateProject(
  id: string,
  input: SupplyProjectInput
): Promise<SupplyProjectWithRelations | undefined> {
  const { data, error } = await getSupabase()
    .from("projects")
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PROJECT_SELECT)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("update the project", error);
  }
  return data ? rowToProject(data as unknown as ProjectRow) : undefined;
}

/** Reassign (or unassign with null) the project's vendor. */
export async function assignVendor(
  id: string,
  vendorId: string | null
): Promise<SupplyProjectWithRelations | undefined> {
  const { data, error } = await getSupabase()
    .from("projects")
    .update({ vendor_id: vendorId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PROJECT_SELECT)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("assign the vendor", error);
  }
  return data ? rowToProject(data as unknown as ProjectRow) : undefined;
}

export async function changeProjectStatus(
  id: string,
  newStatus: SupplyProjectStatus,
  options?: {
    note?: string;
    actualCompletionDate?: string;
    finalCostNgn?: number;
    finalCostUsd?: number;
  }
): Promise<SupplyProjectWithRelations | undefined> {
  const sb = getSupabase();
  const { data: existing, error: readError } = await sb
    .from("projects")
    .select(
      "id, status, buyer_id, budgeted_cost_ngn, final_cost_ngn, budgeted_cost_usd, final_cost_usd"
    )
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    if (isInvalidInput(readError)) return undefined;
    fail("load the project", readError);
  }
  if (!existing) return undefined;

  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (options?.actualCompletionDate) {
    patch.actual_completion_date = options.actualCompletionDate;
  }
  if (options?.finalCostNgn !== undefined) {
    patch.final_cost_ngn = options.finalCostNgn;
  }
  if (options?.finalCostUsd !== undefined) {
    patch.final_cost_usd = options.finalCostUsd;
  }

  // Completing a project requires a final cost in every currency it was
  // budgeted in, so savings compute for the whole (possibly split) contract.
  if (newStatus === "completed") {
    const finalNgn = options?.finalCostNgn ?? existing.final_cost_ngn;
    const finalUsd = options?.finalCostUsd ?? existing.final_cost_usd;
    if (existing.budgeted_cost_ngn !== null && finalNgn === null) {
      throw new StoreError(
        "This project has a ₦ budget — record the final ₦ cost to complete it."
      );
    }
    if (existing.budgeted_cost_usd !== null && finalUsd === null) {
      throw new StoreError(
        "This project has a $ budget — record the final $ cost to complete it."
      );
    }
  }

  const { data, error } = await sb
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select(PROJECT_SELECT)
    .single();
  if (error) fail("change the project status", error);

  // Audit trail. No auth system exists, so attribute the change to the buyer
  // handling the project — replace with the signed-in user once auth lands.
  const { error: histError } = await sb.from("project_status_history").insert({
    project_id: id,
    old_status: existing.status,
    new_status: newStatus,
    changed_by: existing.buyer_id,
    note: options?.note ?? null,
  });
  if (histError) fail("record the status change", histError);

  return rowToProject(data as unknown as ProjectRow);
}

export async function deleteProject(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (isInvalidInput(error)) return false;
    fail("delete the project", error);
  }
  return (data ?? []).length > 0;
}
