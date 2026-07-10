/**
 * Request-body validation for the supply chain API routes, following the
 * shape of lib/validation.ts: return { data } or { error }.
 */
import type {
  BuyerInput,
  ProcurementMethod,
  SupplyProjectInput,
  VendorCategory,
  VendorDocumentInput,
  VendorDocumentType,
  VendorInput,
  VendorStatus,
} from "@/types";

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "Drilling Services",
  "Engineering and Fabrication",
  "Procurement and Supply",
  "Logistics and Marine",
  "Inspection and Testing",
  "HSE Services",
  "Manpower Supply",
  "Equipment Rental",
  "Chemicals",
  "IT and Communications",
  "Other",
];

export const VENDOR_STATUSES: VendorStatus[] = [
  "active",
  "suspended",
  "blacklisted",
  "inactive",
];

export const DOCUMENT_TYPES: VendorDocumentType[] = [
  "Certificate of Incorporation (CAC)",
  "CAC Form C02 (Allotment of Shares)",
  "CAC Form C07 (List of Directors)",
  "NUPRC Certificate",
  "NCDMB / NOGIC JQS registration",
  "NIPEX / NJQS prequalification",
  "Tax Clearance Certificate (TCC)",
  "VAT Registration Certificate",
  "HSE / ISO certification",
  "Insurance certificate",
  "Bank reference letter",
  "Audited financial statements",
  "Other",
];

export const PROCUREMENT_METHODS: ProcurementMethod[] = [
  "open competitive bidding",
  "restricted tender",
  "two stage tender",
  "single source",
];

export const PROJECT_STATUSES = [
  "ongoing",
  "completed",
  "cancelled",
  "delayed",
  "expired",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Result<T> = { data: T } | { error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optStr(v: unknown): string | undefined {
  const s = str(v);
  return s || undefined;
}

function optNum(v: unknown, label: string, min: number, max: number):
  | { value: number | undefined }
  | { error: string } {
  if (v === undefined || v === null || v === "") return { value: undefined };
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: `${label} must be a number between ${min} and ${max}.` };
  }
  return { value: n };
}

export function parseBuyerInput(body: unknown): Result<BuyerInput> {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;
  const fullName = str(b.fullName);
  if (!fullName) return { error: "Full name is required." };
  const email = str(b.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "A valid email is required." };
  return { data: { fullName, email } };
}

export function parseVendorInput(body: unknown): Result<VendorInput> {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;

  const name = str(b.name);
  if (!name) return { error: "Company name is required." };

  const email = optStr(b.email);
  if (email && !EMAIL_RE.test(email)) {
    return { error: "Email must be a valid address." };
  }

  const category = b.category as VendorCategory;
  if (!VENDOR_CATEGORIES.includes(category)) {
    return { error: "A valid category is required." };
  }

  const status = (b.status ?? "active") as VendorStatus;
  if (!VENDOR_STATUSES.includes(status)) {
    return { error: "A valid status is required." };
  }

  const equity = optNum(b.nigerianEquityPercentage, "Nigerian equity", 0, 100);
  if ("error" in equity) return equity;

  const scores: Record<string, number | undefined> = {};
  for (const key of [
    "deliveryScore",
    "qualityScore",
    "hseScore",
    "complianceScore",
    "confidenceOverride",
  ] as const) {
    const parsed = optNum(b[key], key.replace(/Score|Override/, " score"), 0, 5);
    if ("error" in parsed) return parsed;
    scores[key] = parsed.value;
  }

  return {
    data: {
      name,
      rcNumber: optStr(b.rcNumber),
      contactPerson: optStr(b.contactPerson),
      email,
      phone: optStr(b.phone),
      address: optStr(b.address),
      state: optStr(b.state),
      category,
      nigerianEquityPercentage: equity.value,
      deliveryScore: scores.deliveryScore,
      qualityScore: scores.qualityScore,
      hseScore: scores.hseScore,
      complianceScore: scores.complianceScore,
      confidenceOverride: scores.confidenceOverride,
      status,
      notes: optStr(b.notes),
    },
  };
}

export function parseDocumentInput(body: unknown): Result<VendorDocumentInput> {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;

  const documentType = b.documentType as VendorDocumentType;
  if (!DOCUMENT_TYPES.includes(documentType)) {
    return { error: "A valid document type is required." };
  }
  const documentName = str(b.documentName);
  if (!documentName) return { error: "Document name is required." };

  const issueDate = optStr(b.issueDate);
  if (issueDate && !ISO_DATE.test(issueDate)) {
    return { error: "Issue date must be a valid date." };
  }
  const expiryDate = optStr(b.expiryDate);
  if (expiryDate && !ISO_DATE.test(expiryDate)) {
    return { error: "Expiry date must be a valid date." };
  }
  if (issueDate && expiryDate && new Date(expiryDate) <= new Date(issueDate)) {
    return { error: "Expiry date must be after the issue date." };
  }

  return {
    data: {
      documentType,
      documentName,
      documentNumber: optStr(b.documentNumber),
      issueDate,
      expiryDate,
    },
  };
}

export function parseProjectInput(body: unknown): Result<SupplyProjectInput> {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;

  const title = str(b.title);
  if (!title) return { error: "Title is required." };
  const referenceNumber = str(b.referenceNumber);
  if (!referenceNumber) return { error: "Reference number is required." };
  const buyerId = str(b.buyerId);
  if (!buyerId) return { error: "A buyer is required." };

  const procurementMethod = b.procurementMethod as ProcurementMethod;
  if (!PROCUREMENT_METHODS.includes(procurementMethod)) {
    return { error: "A valid procurement method is required." };
  }

  const budgeted = optNum(b.budgetedCost, "Budgeted cost", 0, Number.MAX_SAFE_INTEGER);
  if ("error" in budgeted) return budgeted;
  if (budgeted.value === undefined) return { error: "Budgeted cost is required." };

  const finalCost = optNum(b.finalCost, "Final cost", 0, Number.MAX_SAFE_INTEGER);
  if ("error" in finalCost) return finalCost;

  const usdValue = optNum(b.usdValue, "USD value", 0, Number.MAX_SAFE_INTEGER);
  if ("error" in usdValue) return usdValue;

  const nc = optNum(b.nigerianContentPercentage, "Nigerian content", 0, 100);
  if ("error" in nc) return nc;

  const currency = (b.currency ?? "NGN") as "NGN" | "USD";
  if (currency !== "NGN" && currency !== "USD") {
    return { error: "Currency must be NGN or USD." };
  }

  const startDate = str(b.startDate);
  const endDate = str(b.endDate);
  if (!ISO_DATE.test(startDate)) return { error: "Start date is required." };
  if (!ISO_DATE.test(endDate)) return { error: "Planned end date is required." };
  if (new Date(endDate) <= new Date(startDate)) {
    return { error: "Planned end date must be after the start date." };
  }
  const actual = optStr(b.actualCompletionDate);
  if (actual && !ISO_DATE.test(actual)) {
    return { error: "Actual completion date must be a valid date." };
  }

  return {
    data: {
      title,
      referenceNumber,
      description: optStr(b.description),
      vendorId: optStr(b.vendorId),
      buyerId,
      procurementMethod,
      budgetedCost: budgeted.value,
      finalCost: finalCost.value,
      currency,
      usdValue: usdValue.value,
      startDate,
      endDate,
      actualCompletionDate: actual,
      nigerianContentPercentage: nc.value,
    },
  };
}
