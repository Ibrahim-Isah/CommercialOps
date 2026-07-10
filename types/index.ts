/**
 * Shared data models for the Commercial Ops Dashboard.
 * Keeping all domain types here means API routes, the data layer and the UI
 * all agree on the same shapes. Swap-friendly: these map cleanly to DB rows.
 */

// ---------------------------------------------------------------------------
// Vessels
// ---------------------------------------------------------------------------
export type VesselStatus =
  | "Under way using engine"
  | "At anchor"
  | "Moored"
  | "Restricted manoeuvrability"
  | "Constrained by draught"
  | "Aground"
  | "Not under command"
  | "Unknown";

export interface Vessel {
  /** Maritime Mobile Service Identity — the unique key we track on. */
  mmsi: string;
  /** IMO number (7 digits) when known. */
  imo?: string;
  name: string;
  /** Vessel type, e.g. "Crude Oil Tanker", "LNG Carrier". */
  type: string;
  /** Flag state. */
  flag?: string;
  latitude: number;
  longitude: number;
  /** Speed over ground in knots. */
  speed: number;
  /** Course over ground in degrees. */
  heading: number;
  status: VesselStatus;
  /** Radio call sign when known. */
  callSign?: string;
  /** Overall length in metres when known. */
  length?: number;
  /** Beam in metres when known. */
  beam?: number;
  /** Maximum static draught in metres when known. */
  draught?: number;
  destination?: string;
  /** ETA as an ISO string when known. */
  eta?: string;
  /** Last position-report time as an ISO string. */
  lastUpdated: string;
  /** True when this record came from mock data rather than a live feed. */
  isMock: boolean;
}

// ---------------------------------------------------------------------------
// Certificates & clearances
// ---------------------------------------------------------------------------
export type CertificateCategory =
  | "Regulatory"
  | "Operational"
  | "Insurance"
  | "Vessel"
  | "Environmental"
  | "Other";

/** Computed at read time from the expiration date. */
export type CertificateStatus = "Active" | "Expiring Soon" | "Expired";

export interface Certificate {
  id: string;
  name: string;
  issuingBody: string;
  category: CertificateCategory;
  /** Registration / issue date as an ISO date string (yyyy-mm-dd). */
  registrationDate: string;
  /** Expiration date as an ISO date string (yyyy-mm-dd). */
  expirationDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Certificate enriched with the values the UI needs but does not store. */
export interface CertificateWithStatus extends Certificate {
  status: CertificateStatus;
  daysRemaining: number;
}

/** Payload accepted by create / update endpoints. */
export interface CertificateInput {
  name: string;
  issuingBody: string;
  category: CertificateCategory;
  registrationDate: string;
  expirationDate: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------
export interface PricePoint {
  /** ISO date string (yyyy-mm-dd). */
  date: string;
  /** Spot price in USD per barrel. */
  price: number;
}

export interface PriceSeries {
  /** Series label, e.g. "Brent Crude (Europe Spot, FOB)". */
  label: string;
  points: PricePoint[];
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  /** Stats over the returned window. */
  high: number;
  low: number;
  average: number;
  volatility: number;
  /** True when generated mock data was returned. */
  isMock: boolean;
  /** When the server produced this response (ISO). */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------
export interface ForecastPoint {
  date: string;
  /** Present on historical rows. */
  actual?: number;
  /** Present on projected rows. */
  forecast?: number;
  /** Optional confidence band. */
  upper?: number;
  lower?: number;
}

export interface ForecastResult {
  label: string;
  points: ForecastPoint[];
  horizonDays: number;
  /** Slope of the fitted trend (USD/barrel per day). */
  trendPerDay: number;
  method: string;
  isMock: boolean;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export type NewsCategory = "Crude" | "Gas/LNG" | "OPEC" | "Regulatory" | "General";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  /** ISO date string. */
  publishedAt: string;
  description?: string;
  /** Keyword-derived categories used by the filter. */
  categories: NewsCategory[];
}

export interface NewsResponse {
  items: NewsItem[];
  isMock: boolean;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Supply chain — buyers, vendors, projects
// ---------------------------------------------------------------------------
export interface Buyer {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerInput {
  fullName: string;
  email: string;
}

export type VendorStatus = "active" | "suspended" | "blacklisted" | "inactive";

export type VendorCategory =
  | "Drilling Services"
  | "Engineering and Fabrication"
  | "Procurement and Supply"
  | "Logistics and Marine"
  | "Inspection and Testing"
  | "HSE Services"
  | "Manpower Supply"
  | "Equipment Rental"
  | "Chemicals"
  | "IT and Communications"
  | "Other";

export interface Vendor {
  id: string;
  name: string;
  rcNumber?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Nigerian state. */
  state?: string;
  category: VendorCategory;
  /** 0–100; 51%+ marks an indigenous company for local-content purposes. */
  nigerianEquityPercentage?: number;
  /** Performance sub-scores, 0–5. */
  deliveryScore?: number;
  qualityScore?: number;
  hseScore?: number;
  complianceScore?: number;
  /** Manual override for the computed confidence rating (0–5). */
  confidenceOverride?: number;
  /** Weighted average of the sub-scores, or the override when set. */
  confidenceRating?: number;
  status: VendorStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorInput = Omit<
  Vendor,
  "id" | "confidenceRating" | "createdAt" | "updatedAt"
>;

/** Vendor list row enriched with per-vendor aggregates. */
export interface VendorWithStats extends Vendor {
  projectCount: number;
  documentCounts: { total: number; expired: number; expiringSoon: number };
}

export type VendorDocumentType =
  | "Certificate of Incorporation (CAC)"
  | "CAC Form C02 (Allotment of Shares)"
  | "CAC Form C07 (List of Directors)"
  | "NUPRC Certificate"
  | "NCDMB / NOGIC JQS registration"
  | "NIPEX / NJQS prequalification"
  | "Tax Clearance Certificate (TCC)"
  | "VAT Registration Certificate"
  | "HSE / ISO certification"
  | "Insurance certificate"
  | "Bank reference letter"
  | "Audited financial statements"
  | "Other";

/** Derived from expiry_date at read time; documents without one are Valid. */
export type VendorDocumentStatus = "Valid" | "Expiring Soon" | "Expired";

export interface VendorDocument {
  id: string;
  vendorId: string;
  documentType: VendorDocumentType;
  documentName: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: VendorDocumentStatus;
  /** Days until expiry (negative when expired); undefined when no expiry. */
  daysToExpiry?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorDocumentInput {
  documentType: VendorDocumentType;
  documentName: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

export type SupplyProjectStatus =
  | "ongoing"
  | "completed"
  | "cancelled"
  | "delayed"
  | "expired";

export type ProcurementMethod =
  | "open competitive bidding"
  | "restricted tender"
  | "two stage tender"
  | "single source";

export interface SupplyProject {
  id: string;
  title: string;
  referenceNumber: string;
  description?: string;
  vendorId?: string;
  buyerId: string;
  status: SupplyProjectStatus;
  procurementMethod: ProcurementMethod;
  /** ₦ unless currency says otherwise. */
  budgetedCost: number;
  finalCost?: number;
  /** budgeted − final; null until a final cost exists. */
  costSavings?: number;
  currency: "NGN" | "USD";
  usdValue?: number;
  startDate: string;
  /** Planned completion. */
  endDate: string;
  actualCompletionDate?: string;
  nigerianContentPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

export type SupplyProjectInput = Omit<
  SupplyProject,
  "id" | "status" | "costSavings" | "createdAt" | "updatedAt"
> & { status?: SupplyProjectStatus };

/** Project list row enriched with names and delay awareness. */
export interface SupplyProjectWithRelations extends SupplyProject {
  vendorName?: string;
  buyerName: string;
  /** Ongoing/delayed but past the planned end date. */
  pastDue: boolean;
}

export interface ProjectStatusChange {
  id: string;
  projectId: string;
  oldStatus?: SupplyProjectStatus;
  newStatus: SupplyProjectStatus;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Supply chain analytics (one payload for the dashboard)
// ---------------------------------------------------------------------------
export interface SupplyChainAnalytics {
  statusCounts: Record<SupplyProjectStatus, number>;
  totalProjects: number;
  totalSavings: number;
  totalBudgeted: number;
  totalFinal: number;
  savingsByMonth: Array<{ month: string; savings: number }>;
  topBuyers: Array<{
    id: string;
    name: string;
    totalSavings: number;
    projectCount: number;
  }>;
  vendorSnapshot: {
    total: number;
    active: number;
    withExpiredDocs: number;
    withExpiringDocs: number;
  };
  methodBreakdown: Array<{
    method: ProcurementMethod;
    count: number;
    budgeted: number;
  }>;
  /** Average across active (ongoing/delayed) projects; null when none set. */
  avgNigerianContent: number | null;
  topVendors: Array<{
    id: string;
    name: string;
    projectCount: number;
    totalValue: number;
  }>;
  complianceAlerts: Array<{
    vendorId: string;
    vendorName: string;
    documentName: string;
    documentType: VendorDocumentType;
    expiryDate: string;
    status: VendorDocumentStatus;
    daysToExpiry: number;
  }>;
  timeliness: { onTime: number; late: number; pastDueOngoing: number };
}

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------
export interface ApiError {
  error: string;
}
