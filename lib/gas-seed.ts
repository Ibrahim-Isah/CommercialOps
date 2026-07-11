/**
 * First-run seed data for the gas tables.
 *
 * Benchmark history: approximate MONTHLY average prices in USD/MMBtu for the
 * three global gas benchmarks, 2021 → mid-2026, hand-curated from public
 * summaries (EIA for Henry Hub, exchange summaries for TTF and JKM). They are
 * reference approximations, good enough to drive trend/volatility estimates —
 * replace or extend the rows in Supabase (price_series) for higher fidelity.
 *
 * PIA prices: the NMDPRA-published Domestic Base Price and sector prices under
 * the PIA. Set annually (effective 1 April); edit the pia_gas_price rows each
 * year when the regulator publishes new values.
 */
import type { GasBenchmarkKey, PiaSector } from "@/types";

/** Monthly USD/MMBtu values per year (Jan..Dec; the final year may be partial). */
const MONTHLY: Record<GasBenchmarkKey, Record<number, number[]>> = {
  henry_hub: {
    2021: [2.71, 2.62, 2.62, 2.66, 2.91, 3.26, 3.84, 4.07, 5.16, 5.51, 5.05, 3.76],
    2022: [4.38, 4.69, 4.9, 6.6, 8.14, 7.7, 7.28, 8.81, 7.88, 5.66, 5.45, 5.53],
    2023: [3.27, 2.38, 2.31, 2.16, 2.15, 2.18, 2.55, 2.58, 2.64, 2.98, 2.71, 2.52],
    2024: [3.18, 1.72, 1.49, 1.6, 2.12, 2.54, 2.07, 1.98, 2.28, 2.2, 2.12, 3.01],
    2025: [4.13, 4.19, 4.0, 3.44, 3.12, 3.02, 3.31, 2.91, 2.95, 3.05, 3.15, 3.6],
    2026: [3.9, 3.6, 3.3, 3.1, 3.2, 3.3],
  },
  ttf: {
    2021: [6.5, 5.9, 6.2, 7.4, 8.8, 10.4, 12.5, 15.0, 22.5, 30.0, 27.0, 36.0],
    2022: [27.0, 25.0, 38.0, 31.0, 26.0, 30.0, 50.0, 70.0, 57.0, 38.0, 35.0, 35.0],
    2023: [19.0, 16.5, 14.0, 13.5, 10.5, 10.0, 9.5, 10.5, 11.0, 13.0, 13.5, 11.5],
    2024: [9.5, 8.5, 8.7, 9.3, 10.2, 10.8, 10.5, 11.5, 11.8, 12.8, 13.5, 13.2],
    2025: [14.5, 15.5, 13.0, 11.5, 11.0, 11.5, 10.8, 10.5, 10.2, 10.8, 11.2, 11.0],
    2026: [10.5, 10.0, 9.5, 9.0, 9.2, 9.4],
  },
  jkm: {
    2021: [13.0, 8.5, 6.5, 7.8, 9.0, 10.8, 13.0, 16.5, 20.0, 29.0, 25.0, 34.0],
    2022: [25.0, 24.0, 34.0, 28.0, 23.0, 26.0, 40.0, 54.0, 45.0, 30.0, 29.0, 30.0],
    2023: [20.0, 17.0, 14.5, 12.5, 10.5, 9.5, 10.0, 11.5, 12.5, 14.5, 15.5, 12.5],
    2024: [10.0, 9.0, 9.3, 9.9, 10.8, 11.5, 11.8, 12.8, 13.0, 13.5, 14.5, 14.0],
    2025: [15.0, 16.0, 13.5, 12.0, 11.5, 12.0, 11.3, 11.0, 10.8, 11.3, 11.8, 11.5],
    2026: [11.0, 10.5, 10.0, 9.5, 9.7, 9.9],
  },
};

export function seedPriceSeriesRows(): Array<{
  series_name: GasBenchmarkKey;
  date: string;
  price: number;
  unit: string;
  currency: string;
}> {
  const rows: ReturnType<typeof seedPriceSeriesRows> = [];
  for (const [name, years] of Object.entries(MONTHLY) as Array<
    [GasBenchmarkKey, Record<number, number[]>]
  >) {
    for (const [year, values] of Object.entries(years)) {
      values.forEach((price, monthIdx) => {
        const month = String(monthIdx + 1).padStart(2, "0");
        rows.push({
          series_name: name,
          date: `${year}-${month}-15`, // mid-month stamp for a monthly average
          price,
          unit: "USD/MMBtu",
          currency: "USD",
        });
      });
    }
  }
  return rows;
}

/**
 * NMDPRA PIA gas prices per marketing year (effective 1 April).
 * price = the sector price (for gas-based industries: the ceiling, i.e. the
 * DBP); floor only for the band sector.
 */
export function seedPiaRows(): Array<{
  effective_date: string;
  sector: PiaSector;
  price_usd_mmbtu: number;
  floor_usd_mmbtu: number | null;
}> {
  const years: Array<[string, number, number]> = [
    // [effective date, DBP (power), commercial]
    ["2024-04-01", 2.42, 2.92],
    ["2025-04-01", 2.13, 2.63],
    ["2026-04-01", 2.18, 2.68],
  ];
  return years.flatMap(([date, dbp, commercial]) => [
    { effective_date: date, sector: "power" as const, price_usd_mmbtu: dbp, floor_usd_mmbtu: null },
    { effective_date: date, sector: "commercial" as const, price_usd_mmbtu: commercial, floor_usd_mmbtu: null },
    {
      effective_date: date,
      sector: "gas_based_industries" as const,
      price_usd_mmbtu: dbp, // band ceiling = the DBP
      floor_usd_mmbtu: 0.9,
    },
  ]);
}
