/**
 * Vendor + vendor-document persistence (Supabase).
 * Row mapping follows the lib/store.ts convention: snake_case DB columns,
 * camelCase app types, derived fields computed at read time.
 */
import { getSupabase } from "@/lib/supabase";
import { StoreError } from "@/lib/store";
import { fail, isInvalidInput } from "@/lib/supply-chain/common";
import { confidenceRating, documentStatus } from "@/lib/supply-chain/derive";
import type {
  Vendor,
  VendorDocument,
  VendorDocumentInput,
  VendorInput,
  VendorWithStats,
} from "@/types";

interface VendorRow {
  id: string;
  name: string;
  rc_number: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  category: Vendor["category"];
  nigerian_equity_percentage: number | null;
  delivery_score: number | null;
  quality_score: number | null;
  hse_score: number | null;
  compliance_score: number | null;
  confidence_override: number | null;
  status: Vendor["status"];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  vendor_id: string;
  document_type: VendorDocument["documentType"];
  document_name: string;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

function rowToVendor(row: VendorRow): Vendor {
  const base = {
    id: row.id,
    name: row.name,
    rcNumber: row.rc_number ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    state: row.state ?? undefined,
    category: row.category,
    nigerianEquityPercentage: row.nigerian_equity_percentage ?? undefined,
    deliveryScore: row.delivery_score ?? undefined,
    qualityScore: row.quality_score ?? undefined,
    hseScore: row.hse_score ?? undefined,
    complianceScore: row.compliance_score ?? undefined,
    confidenceOverride: row.confidence_override ?? undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return { ...base, confidenceRating: confidenceRating(base) };
}

function inputToRow(input: VendorInput) {
  return {
    name: input.name,
    rc_number: input.rcNumber ?? null,
    contact_person: input.contactPerson ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    state: input.state ?? null,
    category: input.category,
    nigerian_equity_percentage: input.nigerianEquityPercentage ?? null,
    delivery_score: input.deliveryScore ?? null,
    quality_score: input.qualityScore ?? null,
    hse_score: input.hseScore ?? null,
    compliance_score: input.complianceScore ?? null,
    confidence_override: input.confidenceOverride ?? null,
    status: input.status,
    notes: input.notes ?? null,
  };
}

export function rowToDocument(row: DocumentRow): VendorDocument {
  const { status, daysToExpiry } = documentStatus(row.expiry_date);
  return {
    id: row.id,
    vendorId: row.vendor_id,
    documentType: row.document_type,
    documentName: row.document_name,
    documentNumber: row.document_number ?? undefined,
    issueDate: row.issue_date ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    fileUrl: row.file_url ?? undefined,
    status,
    daysToExpiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Vendors ------------------------------------------------------------------

export async function listVendors(): Promise<VendorWithStats[]> {
  const sb = getSupabase();
  const [vendors, projects, documents] = await Promise.all([
    sb.from("vendors").select("*").order("name", { ascending: true }),
    sb.from("projects").select("vendor_id"),
    sb.from("vendor_documents").select("vendor_id, expiry_date"),
  ]);
  if (vendors.error) fail("load vendors", vendors.error);
  if (projects.error) fail("load vendor project counts", projects.error);
  if (documents.error) fail("load vendor documents", documents.error);

  const projectCounts = new Map<string, number>();
  for (const p of projects.data as Array<{ vendor_id: string | null }>) {
    if (!p.vendor_id) continue;
    projectCounts.set(p.vendor_id, (projectCounts.get(p.vendor_id) ?? 0) + 1);
  }

  const docCounts = new Map<
    string,
    { total: number; expired: number; expiringSoon: number }
  >();
  for (const d of documents.data as Array<{
    vendor_id: string;
    expiry_date: string | null;
  }>) {
    const counts =
      docCounts.get(d.vendor_id) ?? { total: 0, expired: 0, expiringSoon: 0 };
    counts.total += 1;
    const { status } = documentStatus(d.expiry_date);
    if (status === "Expired") counts.expired += 1;
    if (status === "Expiring Soon") counts.expiringSoon += 1;
    docCounts.set(d.vendor_id, counts);
  }

  return (vendors.data as VendorRow[]).map((row) => ({
    ...rowToVendor(row),
    projectCount: projectCounts.get(row.id) ?? 0,
    documentCounts:
      docCounts.get(row.id) ?? { total: 0, expired: 0, expiringSoon: 0 },
  }));
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  const { data, error } = await getSupabase()
    .from("vendors")
    .insert(inputToRow(input))
    .select("*")
    .single();
  if (error) fail("create the vendor", error);
  return rowToVendor(data as VendorRow);
}

export async function getVendor(id: string): Promise<
  | {
      vendor: Vendor;
      documents: VendorDocument[];
    }
  | null
> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return null;
    fail("load the vendor", error);
  }
  if (!data) return null;

  const docs = await sb
    .from("vendor_documents")
    .select("*")
    .eq("vendor_id", id)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (docs.error) fail("load the vendor's documents", docs.error);

  return {
    vendor: rowToVendor(data as VendorRow),
    documents: (docs.data as DocumentRow[]).map(rowToDocument),
  };
}

export async function updateVendor(
  id: string,
  input: VendorInput
): Promise<Vendor | undefined> {
  const { data, error } = await getSupabase()
    .from("vendors")
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("update the vendor", error);
  }
  return data ? rowToVendor(data as VendorRow) : undefined;
}

/**
 * Deleting a vendor with active (ongoing/delayed) projects is blocked — the
 * safer behaviour: reassign those projects first. Completed/cancelled project
 * references survive via ON DELETE SET NULL.
 */
export async function deleteVendor(
  id: string
): Promise<"deleted" | "blocked" | "notfound"> {
  const sb = getSupabase();
  const active = await sb
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", id)
    .in("status", ["ongoing", "delayed"]);
  if (active.error) {
    if (isInvalidInput(active.error)) return "notfound";
    fail("check the vendor's projects", active.error);
  }
  if ((active.count ?? 0) > 0) return "blocked";

  const { data, error } = await sb
    .from("vendors")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) fail("delete the vendor", error);
  return (data ?? []).length > 0 ? "deleted" : "notfound";
}

// --- Vendor documents -----------------------------------------------------------

const DOCUMENTS_BUCKET = "vendor-documents";

/** Upload a document file to Supabase Storage; returns its public URL. */
export async function uploadDocumentFile(
  vendorId: string,
  file: File
): Promise<string> {
  const sb = getSupabase();
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${vendorId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await sb.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (error) {
    throw new StoreError(
      `Failed to upload the file. (${error.message ?? "storage error"})`
    );
  }
  return sb.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function addDocument(
  vendorId: string,
  input: VendorDocumentInput,
  fileUrl?: string
): Promise<VendorDocument> {
  const { data, error } = await getSupabase()
    .from("vendor_documents")
    .insert({
      vendor_id: vendorId,
      document_type: input.documentType,
      document_name: input.documentName,
      document_number: input.documentNumber ?? null,
      issue_date: input.issueDate ?? null,
      expiry_date: input.expiryDate ?? null,
      file_url: fileUrl ?? null,
    })
    .select("*")
    .single();
  if (error) fail("add the document", error);
  return rowToDocument(data as DocumentRow);
}

export async function updateDocument(
  id: string,
  input: VendorDocumentInput,
  fileUrl?: string
): Promise<VendorDocument | undefined> {
  const patch: Record<string, unknown> = {
    document_type: input.documentType,
    document_name: input.documentName,
    document_number: input.documentNumber ?? null,
    issue_date: input.issueDate ?? null,
    expiry_date: input.expiryDate ?? null,
    updated_at: new Date().toISOString(),
  };
  if (fileUrl) patch.file_url = fileUrl; // keep the existing file unless replaced
  const { data, error } = await getSupabase()
    .from("vendor_documents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("update the document", error);
  }
  return data ? rowToDocument(data as DocumentRow) : undefined;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("vendor_documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (isInvalidInput(error)) return false;
    fail("delete the document", error);
  }
  return (data ?? []).length > 0;
}
