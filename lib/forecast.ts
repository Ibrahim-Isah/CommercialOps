/**
 * Transparent, lightweight price forecast.
 *
 * Method (intentionally simple and explainable):
 *  1. Fit an ordinary least-squares linear trend to the recent history.
 *  2. Anchor the projection at a short moving average of the latest prices
 *     (smooths out a noisy final day).
 *  3. Project forward by extending the trend from that anchor.
 *  4. Draw a confidence band of +/- 1.96 * (recent daily volatility) that
 *     widens with the square root of the horizon, like a simple random walk.
 *
 * This is a statistical estimate for internal awareness only — NOT investment
 * or trading advice. The UI states this prominently.
 */
import type { ForecastPoint, ForecastResult, PricePoint } from "@/types";

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ordinary least-squares slope/intercept over y indexed by x = 0..n-1. */
function linearFit(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

/** Standard deviation of day-over-day changes (recent volatility). */
function dailyVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < prices.length; i++) diffs.push(prices[i] - prices[i - 1]);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance =
    diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length;
  return Math.sqrt(variance);
}

const round = (n: number) => Math.round(n * 100) / 100;

export function buildForecast(
  history: PricePoint[],
  horizonDays: number,
  label: string,
  isMock: boolean
): ForecastResult {
  // Use up to the last 60 observations for trend/volatility.
  const window = history.slice(-60);
  const prices = window.map((p) => p.price);

  const { slope } = linearFit(prices);
  const maWindow = Math.min(5, prices.length);
  const anchor =
    prices.slice(-maWindow).reduce((a, b) => a + b, 0) / (maWindow || 1);
  const vol = dailyVolatility(prices);

  // Historical actuals (show the last 90 days for context).
  const histTail = history.slice(-90);
  const points: ForecastPoint[] = histTail.map((p) => ({
    date: p.date,
    actual: p.price,
  }));

  const lastDate = history[history.length - 1]?.date ?? new Date()
    .toISOString()
    .slice(0, 10);
  const lastActual = history[history.length - 1]?.price ?? anchor;

  // Bridge point so the dashed forecast line connects to the actuals.
  if (points.length > 0) {
    points[points.length - 1].forecast = lastActual;
  }

  for (let day = 1; day <= horizonDays; day++) {
    const projected = anchor + slope * day;
    const band = 1.96 * vol * Math.sqrt(day);
    points.push({
      date: addDaysISO(lastDate, day),
      forecast: round(projected),
      upper: round(projected + band),
      lower: round(projected - band),
    });
  }

  return {
    label,
    points,
    horizonDays,
    trendPerDay: round(slope),
    method:
      "Linear-regression trend over the last 60 days, anchored on a 5-day " +
      "moving average, with a +/-1.96σ confidence band that widens with the " +
      "square root of the horizon.",
    isMock,
  };
}
