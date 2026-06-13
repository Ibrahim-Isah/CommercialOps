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
// Generic API envelope
// ---------------------------------------------------------------------------
export interface ApiError {
  error: string;
}
