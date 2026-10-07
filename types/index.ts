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
// Gas pricing (global benchmarks + Nigeria PIA regulated prices)
// ---------------------------------------------------------------------------
export type GasBenchmarkKey = "henry_hub" | "ttf" | "jkm";

export type PiaSector = "power" | "commercial" | "gas_based_industries";

export interface PiaGasPrice {
  id: string;
  /** Date the regulated price takes effect (annual, 1 April). */
  effectiveDate: string;
  sector: PiaSector;
  /** USD/MMBtu; for band sectors this is the ceiling (the DBP). */
  priceUsdMmbtu: number;
  /** Lower bound, set only for band sectors (gas-based industries). */
  floorUsdMmbtu?: number;
}

export interface GasData {
  /** Historical monthly benchmark prices in USD/MMBtu, oldest first. */
  series: Record<GasBenchmarkKey, PricePoint[]>;
  pia: PiaGasPrice[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export type NewsCategory =
  | "Nigeria"
  | "Crude"
  | "Gas/LNG"
  | "OPEC"
  | "Regulatory"
  | "General";

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

/** Buyer list row enriched with per-buyer aggregates. */
export interface BuyerWithStats extends Buyer {
  projectCount: number;
  ongoingCount: number;
  /** Summed per currency — never combined (no FX rate). */
  savingsNgn: number;
  savingsUsd: number;
}

/** A status change made by a buyer, for the buyer detail activity feed. */
export interface BuyerActivity {
  id: string;
  projectId: string;
  projectTitle: string;
  oldStatus?: SupplyProjectStatus;
  newStatus: SupplyProjectStatus;
  changedAt: string;
  note?: string;
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
  /**
   * Costs are carried per currency: a project may be budgeted in ₦, $, or
   * both (split contracts, e.g. 60/40, hold an amount in each currency).
   * At least one budgeted amount is always present.
   */
  budgetedCostNgn?: number;
  finalCostNgn?: number;
  /** budgetedNgn − finalNgn; undefined until a ₦ final cost exists. */
  costSavingsNgn?: number;
  budgetedCostUsd?: number;
  finalCostUsd?: number;
  /** budgetedUsd − finalUsd; undefined until a $ final cost exists. */
  costSavingsUsd?: number;
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
  "id" | "status" | "costSavingsNgn" | "costSavingsUsd" | "createdAt" | "updatedAt"
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
/** A ₦ and $ amount side by side — the two are never summed (no FX rate). */
export interface MoneyPair {
  ngn: number;
  usd: number;
}

export interface SupplyChainAnalytics {
  statusCounts: Record<SupplyProjectStatus, number>;
  totalProjects: number;
  totalSavings: MoneyPair;
  totalBudgeted: MoneyPair;
  totalFinal: MoneyPair;
  savingsByMonth: Array<{ month: string; ngn: number; usd: number }>;
  topBuyers: Array<{
    id: string;
    name: string;
    savingsNgn: number;
    savingsUsd: number;
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
    budgeted: MoneyPair;
  }>;
  /** Average across active (ongoing/delayed) projects; null when none set. */
  avgNigerianContent: number | null;
  topVendors: Array<{
    id: string;
    name: string;
    projectCount: number;
    totalValue: MoneyPair;
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
// Grievances — local stakeholders grievance mechanism (OPI SXD 001/OERNL r01)
// ---------------------------------------------------------------------------

/** Case severity per the OPI classification (§6.3). */
export type GrievanceSeverity = "Low" | "Medium" | "High";

/** Areas of concern covered by the mechanism (§3, Scope of Application). */
export type GrievanceCategory =
  | "Environmental Concerns"
  | "Gas Flaring"
  | "Land Degradation"
  | "Community Displacement"
  | "Cultural Heritage"
  | "Compensation"
  | "Local Employment"
  | "Community Development Projects"
  | "Community Recognition"
  | "Delayed Payments";

/** Nature of complaint (Annex A.3 Grievance Register list). */
export type GrievanceNature =
  | "Encroachment"
  | "Flooding"
  | "Blasting (noise, vibration)"
  | "Soil erosion"
  | "Oil spill"
  | "Access road"
  | "Land acquisition"
  | "Material transportation and use"
  | "Water pollution"
  | "Gas flaring"
  | "MoUs"
  | "Property damage (farmland, assets)"
  | "Other";

/** Who lodges the grievance (§3: individual and collective grievances). */
export type GrievanceComplainantType = "Individual" | "Group" | "Community";

/** Approved submission channels (§6.2). */
export type GrievanceChannel =
  | "Email"
  | "Written Letter"
  | "Phone Call"
  | "SMS"
  | "WhatsApp"
  | "In-Person Engagement"
  | "Office Visit";

/** Operational jurisdiction where the grievance is registered (§6.2). */
export type GrievanceArea = "Land Area" | "Swamp Area" | "Port Harcourt Office";

/**
 * Where the case sits in the grievance mechanism process (Figure 1):
 * Receive & Register → Acknowledge → Assess & Assign → Investigate →
 * Respond → Follow-Up & Close (with recourse/appeal to the GRC alongside).
 */
export type GrievanceStep =
  | "Receive & Register"
  | "Acknowledge"
  | "Assess & Assign"
  | "Investigate"
  | "Respond"
  | "Follow-Up & Close";

export const GRIEVANCE_STEPS: GrievanceStep[] = [
  "Receive & Register",
  "Acknowledge",
  "Assess & Assign",
  "Investigate",
  "Respond",
  "Follow-Up & Close",
];

/** Lifecycle state of the case (register flags: On-going / Pending / Resolved / Abandoned). */
export type GrievanceStatus = "Open" | "Resolved" | "Closed" | "Abandoned";

/** How the grievance was resolved (§6.6 resolution levels + GRC recourse). */
export type GrievanceResolutionType =
  | "Rapid Response"
  | "First-Level Resolution"
  | "GRC Resolution"
  | "External Redress";

/** Grounds on which a case is closed out (§6.6 close-out). */
export type GrievanceClosureType =
  | "Complainant Sign-Off"
  | "External Redress"
  | "Abandoned";

export interface Grievance {
  id: string;
  /** Serial no. of the Grievance Register, e.g. GRV-2026-0001. */
  referenceNumber: string;
  title: string;
  description?: string;
  category: GrievanceCategory;
  nature: GrievanceNature;
  severity: GrievanceSeverity;
  /** §6.3 high-severity human-rights cases (violence, intimidation, harm to women/girls…). */
  humanRightsRelated: boolean;
  /** §6.2 sensitive grievances — immediately notified to XMD / GMD. */
  sensitive: boolean;
  complainantName: string;
  complainantType: GrievanceComplainantType;
  complainantContact?: string;
  /** Group or body the complainant belongs to (CDC, women's group, youth body…). */
  stakeholderGroup?: string;
  state?: string;
  lga?: string;
  community?: string;
  area: GrievanceArea;
  medium: GrievanceChannel;
  /** Date the grievance occurred / was raised (yyyy-mm-dd). */
  dateOfComplaint: string;
  /** Date of receipt by Company personnel (yyyy-mm-dd). */
  dateReceived: string;
  registeringOfficer: string;
  /** Attached documentation (stamped copies, photos, letters…). */
  documentation?: string;
  responsibleDepartment?: string;
  /** Assigned Grievance Owner. */
  responsiblePerson?: string;
  /** Action to be done. */
  actionRequired?: string;
  /** Target date for resolution ("Duration" of the register). */
  targetResolutionDate?: string;
  /** Resolved on receipt via rapid response, without full investigation. */
  rapidResponse: boolean;
  litigation: boolean;
  step: GrievanceStep;
  status: GrievanceStatus;
  resolutionType?: GrievanceResolutionType;
  resolutionNotes?: string;
  resolvedDate?: string;
  closureType?: GrievanceClosureType;
  closureNotes?: string;
  closedDate?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/** Grievance enriched with read-time derivations for lists and alerts. */
export interface GrievanceWithMeta extends Grievance {
  /** Past the target resolution date and not yet resolved/closed/abandoned. */
  overdue: boolean;
  daysToTarget?: number;
  /** Days from receipt to resolution; open cases measure to today. */
  daysOpen: number;
}

/** Registration fields accepted by create / update endpoints. */
export interface GrievanceInput {
  title: string;
  description?: string;
  category: GrievanceCategory;
  nature: GrievanceNature;
  severity: GrievanceSeverity;
  humanRightsRelated: boolean;
  sensitive: boolean;
  complainantName: string;
  complainantType: GrievanceComplainantType;
  complainantContact?: string;
  stakeholderGroup?: string;
  state?: string;
  lga?: string;
  community?: string;
  area: GrievanceArea;
  medium: GrievanceChannel;
  dateOfComplaint: string;
  dateReceived: string;
  registeringOfficer: string;
  documentation?: string;
  responsibleDepartment?: string;
  responsiblePerson?: string;
  actionRequired?: string;
  targetResolutionDate?: string;
  remarks?: string;
}

export type GrievanceEventType =
  | "registered"
  | "acknowledged"
  | "assigned"
  | "step-change"
  | "engagement"
  | "reminder"
  | "escalation"
  | "response"
  | "resolution"
  | "closure"
  | "note";

/** Audit-trail row: every action taken on a case (§7 traceability). */
export interface GrievanceEvent {
  id: string;
  grievanceId: string;
  type: GrievanceEventType;
  note?: string;
  actor?: string;
  createdAt: string;
}

/** Aggregates for the quarterly monitoring & reporting review (§6.8). */
export interface GrievanceAnalytics {
  total: number;
  statusCounts: Record<GrievanceStatus, number>;
  severityCounts: Record<GrievanceSeverity, number>;
  openHighSeverity: number;
  overdue: number;
  /** Cases resolved on receipt through rapid response. */
  rapidResponseCount: number;
  litigationCount: number;
  avgDaysToResolution: number | null;
  byCategory: Array<{
    category: GrievanceCategory;
    total: number;
    open: number;
    resolved: number;
  }>;
  byNature: Array<{ nature: GrievanceNature; total: number }>;
  byArea: Array<{ area: GrievanceArea; total: number; open: number }>;
  /** Received vs resolved per month (yyyy-mm), oldest first. */
  monthly: Array<{ month: string; received: number; resolved: number }>;
}

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------
export interface ApiError {
  error: string;
}
