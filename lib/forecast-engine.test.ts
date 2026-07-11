import { describe, expect, it } from "vitest";
import {
  buildFanForecast,
  estimateAnnualisedParams,
  invNormCdf,
} from "@/lib/forecast-engine";
import type { PricePoint } from "@/types";

/** Monthly series with mild noise so volatility is non-zero. */
function noisyHistory(months = 36, base = 100): PricePoint[] {
  const points: PricePoint[] = [];
  for (let i = 0; i < months; i++) {
    const year = 2023 + Math.floor(i / 12);
    const month = String((i % 12) + 1).padStart(2, "0");
    // Deterministic +/-3% wobble around the base.
    points.push({
      date: `${year}-${month}-15`,
      price: base * (1 + 0.03 * Math.sin(i)),
    });
  }
  return points;
}

const baseOpts = {
  horizonYears: 5,
  upperPercentile: 85,
  lowerPercentile: 25,
};

describe("invNormCdf", () => {
  it("is 0 at the median and symmetric", () => {
    expect(invNormCdf(0.5)).toBeCloseTo(0, 6);
    expect(invNormCdf(0.85)).toBeCloseTo(1.0364, 3);
    expect(invNormCdf(0.25)).toBeCloseTo(-invNormCdf(0.75), 6);
  });
});

describe("estimateAnnualisedParams", () => {
  it("annualises using the observed spacing", () => {
    // 10% total growth over 12 monthly steps -> ~10%/yr log drift.
    const points: PricePoint[] = [];
    for (let i = 0; i <= 12; i++) {
      const month = String((i % 12) + 1).padStart(2, "0");
      const year = 2025 + Math.floor(i / 12);
      points.push({ date: `${year}-${month}-01`, price: 100 * Math.pow(1.1, i / 12) });
    }
    const params = estimateAnnualisedParams(points);
    expect(params).not.toBeNull();
    expect(params!.drift).toBeCloseTo(Math.log(1.1), 1);
    expect(params!.volatility).toBeCloseTo(0, 4); // perfectly smooth series
  });

  it("returns null for unusable history", () => {
    expect(estimateAnnualisedParams([])).toBeNull();
    expect(
      estimateAnnualisedParams([{ date: "2026-01-01", price: 100 }])
    ).toBeNull();
  });
});

describe("buildFanForecast", () => {
  it("the 50th percentile equals the central line", () => {
    const fan = buildFanForecast(noisyHistory(), {
      ...baseOpts,
      upperPercentile: 50,
      lowerPercentile: 50,
    })!;
    for (const p of fan.points) {
      expect(p.upper).toBeCloseTo(p.central, 2);
      expect(p.lower).toBeCloseTo(p.central, 2);
    }
  });

  it("bands widen with time", () => {
    const fan = buildFanForecast(noisyHistory(), baseOpts)!;
    const spreadAt = (i: number) => fan.points[i].upper - fan.points[i].lower;
    expect(spreadAt(0)).toBeCloseTo(0, 6); // starts on today's price
    expect(spreadAt(12)).toBeGreaterThan(spreadAt(6));
    expect(spreadAt(60)).toBeGreaterThan(spreadAt(12));
  });

  it("growth override replaces the historical drift", () => {
    const fan = buildFanForecast(noisyHistory(), {
      ...baseOpts,
      growthOverride: 0.05,
    })!;
    const oneYear = fan.points[12];
    expect(oneYear.central).toBeCloseTo(fan.p0 * 1.05, 1);
    expect(fan.cagr).toBeCloseTo(0.05, 3);
  });

  it("terminal anchor lands the central path on the anchor", () => {
    const fan = buildFanForecast(noisyHistory(), {
      ...baseOpts,
      terminalAnchor: 140,
    })!;
    expect(fan.points[fan.points.length - 1].central).toBeCloseTo(140, 1);
  });

  it("volatility multiplier of zero collapses the band", () => {
    const fan = buildFanForecast(noisyHistory(), {
      ...baseOpts,
      volatilityMultiplier: 0,
    })!;
    const last = fan.points[fan.points.length - 1];
    expect(last.upper).toBeCloseTo(last.central, 2);
    expect(last.lower).toBeCloseTo(last.central, 2);
  });
});
