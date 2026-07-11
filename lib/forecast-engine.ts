/**
 * Shared long-horizon fan-forecast engine, used by both the oil and the gas
 * forecasts. Pure functions, no I/O — easy to unit test and safe to run on
 * the client so percentile/horizon controls redraw instantly.
 *
 * Method (geometric Brownian motion, kept deliberately transparent):
 *  1. Compute periodic log returns from the historical series.
 *  2. Estimate drift (mean log return) and volatility (std dev of log
 *     returns), both annualised using the observed spacing between points.
 *  3. Central path:   central(t) = P0 * exp(drift * t)
 *  4. Percentile band: band(t,p) = central(t) * exp(z_p * vol * sqrt(t))
 *     where z_p is the inverse normal CDF of the percentile. Uncertainty
 *     grows with sqrt(t), so the fan widens over long horizons.
 *  5. The 50th percentile equals the central line by construction (z_50 = 0).
 *
 * Assumption overrides (all optional, defaults are purely data-driven):
 *  - growthOverride: annual growth rate that replaces the estimated drift.
 *  - terminalAnchor: a price the central path is blended toward so it lands
 *    exactly on the anchor at the horizon (smooth blend in log space).
 *  - volatilityMultiplier: widens (>1) or narrows (<1) the bands.
 *
 * This is a statistical projection, not a prediction — the UI says so.
 */
import type { PricePoint } from "@/types";

export interface FanOptions {
  horizonYears: number;
  /** e.g. 85 for the 85th percentile. Must be > 50. */
  upperPercentile: number;
  /** e.g. 25 for the 25th percentile. Must be < 50. */
  lowerPercentile: number;
  /** Annual growth rate override, e.g. 0.02 for +2%/yr. Null = use history. */
  growthOverride?: number | null;
  /** Price the central path should land on at the horizon. Null = none. */
  terminalAnchor?: number | null;
  /** Scales the estimated volatility. Default 1. */
  volatilityMultiplier?: number;
  /** Output resolution. Default 12 (monthly points). */
  stepsPerYear?: number;
}

export interface FanPoint {
  date: string;
  central: number;
  upper: number;
  lower: number;
}

export interface FanForecast {
  points: FanPoint[];
  /** Last observed price the projection starts from. */
  p0: number;
  startDate: string;
  /** Annualised log drift actually used (after any override). */
  drift: number;
  /** Annualised volatility actually used (after the multiplier). */
  volatility: number;
  /** Implied compound annual growth rate of the central path. */
  cagr: number;
  horizonYears: number;
}

/**
 * Inverse standard-normal CDF (percent-point function), Acklam's rational
 * approximation — accurate to ~1e-9, plenty for chart bands.
 */
export function invNormCdf(p: number): number {
  const pp = Math.min(Math.max(p, 1e-10), 1 - 1e-10);
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
    3.75440866190742];
  const pLow = 0.02425;

  if (pp < pLow) {
    const q = Math.sqrt(-2 * Math.log(pp));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (pp <= 1 - pLow) {
    const q = pp - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - pp));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/**
 * Annualised drift and volatility from a historical series. Spacing between
 * observations is inferred from the dates, so daily and monthly series both
 * work. Returns null when there is too little data (< 3 points).
 */
export function estimateAnnualisedParams(
  history: PricePoint[]
): { drift: number; volatility: number } | null {
  const pts = history.filter((p) => p.price > 0);
  if (pts.length < 3) return null;

  const logReturns: number[] = [];
  let totalGapDays = 0;
  for (let i = 1; i < pts.length; i++) {
    logReturns.push(Math.log(pts[i].price / pts[i - 1].price));
    totalGapDays +=
      (Date.parse(pts[i].date) - Date.parse(pts[i - 1].date)) / 86_400_000;
  }
  const avgGapDays = totalGapDays / logReturns.length;
  if (!(avgGapDays > 0)) return null;
  const periodsPerYear = 365.25 / avgGapDays;

  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) /
    Math.max(1, logReturns.length - 1);

  return {
    drift: mean * periodsPerYear,
    volatility: Math.sqrt(variance) * Math.sqrt(periodsPerYear),
  };
}

function addMonthsISO(dateISO: string, months: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Build the fan forecast. Returns null when the history is unusable. */
export function buildFanForecast(
  history: PricePoint[],
  opts: FanOptions
): FanForecast | null {
  const params = estimateAnnualisedParams(history);
  const last = history[history.length - 1];
  if (!params || !last || last.price <= 0) return null;

  const p0 = last.price;
  const startDate = last.date;
  const T = opts.horizonYears;
  const stepsPerYear = opts.stepsPerYear ?? 12;
  const steps = Math.round(T * stepsPerYear);

  // ln(1+g) so a "+2%/yr growth" override produces exactly *1.02 per year.
  const drift =
    opts.growthOverride !== null && opts.growthOverride !== undefined
      ? Math.log(1 + opts.growthOverride)
      : params.drift;
  const vol = params.volatility * (opts.volatilityMultiplier ?? 1);

  const zUpper = invNormCdf(opts.upperPercentile / 100);
  const zLower = invNormCdf(opts.lowerPercentile / 100);

  const logP0 = Math.log(p0);
  const anchor = opts.terminalAnchor;
  const logAnchorEnd =
    anchor !== null && anchor !== undefined && anchor > 0
      ? Math.log(anchor)
      : null;

  const points: FanPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / stepsPerYear;
    let logCentral = logP0 + drift * t;
    if (logAnchorEnd !== null && T > 0) {
      // Blend smoothly toward the anchor: the anchor path is the straight
      // geometric interpolation P0 → anchor; weight grows linearly with t so
      // the blended path starts on the trend and lands exactly on the anchor.
      const w = t / T;
      const logAnchorPath = logP0 + (logAnchorEnd - logP0) * w;
      logCentral = (1 - w) * logCentral + w * logAnchorPath;
    }
    const central = Math.exp(logCentral);
    const spread = vol * Math.sqrt(t);
    points.push({
      date: addMonthsISO(startDate, Math.round((i * 12) / stepsPerYear)),
      central: round2(central),
      upper: round2(central * Math.exp(zUpper * spread)),
      lower: round2(central * Math.exp(zLower * spread)),
    });
  }

  const terminal = points[points.length - 1].central;
  const cagr = T > 0 ? Math.pow(terminal / p0, 1 / T) - 1 : 0;

  return {
    points,
    p0,
    startDate,
    drift,
    volatility: vol,
    cagr,
    horizonYears: T,
  };
}
