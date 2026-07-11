/**
 * Realistic mock data used as graceful fallbacks whenever a live API key is
 * missing or a live lookup returns nothing. Everything produced here is clearly
 * badged as "Demo data" in the UI so it is never mistaken for live intelligence.
 */
import { randomUUID } from "node:crypto";
import type { Certificate, NewsItem, PricePoint, Vessel } from "@/types";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isoDateTime(offsetMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Seed certificates (first-run examples)
// ---------------------------------------------------------------------------
export function seedCertificates(): Certificate[] {
  const now = new Date().toISOString();
  const base = (
    name: string,
    issuingBody: string,
    category: Certificate["category"],
    regOffset: number,
    expOffset: number,
    notes?: string
  ): Certificate => ({
    id: randomUUID(),
    name,
    issuingBody,
    category,
    registrationDate: isoDate(regOffset),
    expirationDate: isoDate(expOffset),
    notes,
    createdAt: now,
    updatedAt: now,
  });

  return [
    base(
      "NUPRC Crude Oil Export Clearance",
      "NUPRC",
      "Regulatory",
      -300,
      18, // expiring soon
      "Quarterly export lifting authorisation for the Bonny terminal."
    ),
    base(
      "NESS Cargo Inspection Certificate",
      "NESS",
      "Operational",
      -120,
      240
    ),
    base(
      "Customs Export Clearance",
      "Nigerian Customs",
      "Regulatory",
      -40,
      -3 // expired
    ),
    base(
      "P&I Insurance Cover Note",
      "Gard P&I Club",
      "Insurance",
      -200,
      160,
      "Protection & indemnity cover for the chartered fleet."
    ),
    base(
      "Vessel Safety Management Certificate",
      "NIMASA",
      "Vessel",
      -700,
      95
    ),
    base(
      "Environmental Impact Permit",
      "NMDPRA",
      "Environmental",
      -365,
      27 // expiring soon
    ),
    base(
      "ISPS Port Facility Compliance",
      "NIMASA",
      "Regulatory",
      -150,
      500
    ),
  ];
}

// ---------------------------------------------------------------------------
// Mock vessels (crude / product tankers around West Africa & the Atlantic)
// ---------------------------------------------------------------------------
export function mockVessels(): Vessel[] {
  return [
    {
      mmsi: "636019825",
      imo: "9842190",
      name: "BONNY SPIRIT",
      type: "Crude Oil Tanker",
      flag: "Liberia",
      callSign: "D5UT7",
      length: 274,
      beam: 48,
      draught: 16.8,
      latitude: 4.421,
      longitude: 7.157,
      speed: 0.1,
      heading: 215,
      status: "Moored",
      destination: "BONNY TERMINAL",
      eta: isoDateTime(60 * 6),
      lastUpdated: isoDateTime(-4),
      isMock: true,
    },
    {
      mmsi: "538008914",
      imo: "9745782",
      name: "GULF PROGRESS",
      type: "Crude Oil Tanker",
      flag: "Marshall Islands",
      callSign: "V7A2891",
      length: 333,
      beam: 60,
      draught: 21.5,
      latitude: 3.92,
      longitude: 6.55,
      speed: 12.4,
      heading: 187,
      status: "Under way using engine",
      destination: "ROTTERDAM",
      eta: isoDateTime(60 * 24 * 9),
      lastUpdated: isoDateTime(-2),
      isMock: true,
    },
    {
      mmsi: "352001234",
      imo: "9612345",
      name: "ATLANTIC PIONEER",
      type: "Product Tanker",
      flag: "Panama",
      callSign: "3EQL8",
      length: 183,
      beam: 32,
      draught: 12.2,
      latitude: 5.61,
      longitude: 3.02,
      speed: 9.8,
      heading: 95,
      status: "Under way using engine",
      destination: "LAGOS (APAPA)",
      eta: isoDateTime(60 * 20),
      lastUpdated: isoDateTime(-7),
      isMock: true,
    },
    {
      mmsi: "311000456",
      imo: "9501122",
      name: "DELTA HARMONY",
      type: "LNG Carrier",
      flag: "Bahamas",
      callSign: "C6DH4",
      length: 290,
      beam: 46,
      draught: 11.6,
      latitude: 4.05,
      longitude: 7.03,
      speed: 0.0,
      heading: 0,
      status: "At anchor",
      destination: "BONNY LNG",
      eta: isoDateTime(60 * 12),
      lastUpdated: isoDateTime(-11),
      isMock: true,
    },
    {
      mmsi: "477998877",
      imo: "9388210",
      name: "OCEAN VANGUARD",
      type: "Crude Oil Tanker",
      flag: "Hong Kong",
      callSign: "VRVG5",
      length: 250,
      beam: 44,
      draught: 14.9,
      latitude: 6.12,
      longitude: 1.88,
      speed: 14.1,
      heading: 270,
      status: "Under way using engine",
      destination: "FUJAIRAH",
      eta: isoDateTime(60 * 24 * 16),
      lastUpdated: isoDateTime(-1),
      isMock: true,
    },
    {
      mmsi: "563112233",
      imo: "9277541",
      name: "SAPELE TRADER",
      type: "Product Tanker",
      flag: "Singapore",
      callSign: "9V6612",
      length: 176,
      beam: 31,
      draught: 11.8,
      latitude: 5.5,
      longitude: 5.7,
      speed: 6.3,
      heading: 142,
      status: "Restricted manoeuvrability",
      destination: "ESCRAVOS",
      eta: isoDateTime(60 * 30),
      lastUpdated: isoDateTime(-9),
      isMock: true,
    },
    {
      mmsi: "657045566",
      imo: "9155003",
      name: "NIGER STAR",
      type: "Crude Oil Tanker",
      flag: "Nigeria",
      callSign: "5NNS2",
      length: 244,
      beam: 42,
      draught: 14.2,
      latitude: 4.75,
      longitude: 8.32,
      speed: 0.2,
      heading: 33,
      status: "At anchor",
      destination: "QUA IBOE TERMINAL",
      eta: isoDateTime(60 * 18),
      lastUpdated: isoDateTime(-15),
      isMock: true,
    },
    {
      mmsi: "247223344",
      imo: "9066120",
      name: "MEDITERRANEO",
      type: "Crude Oil Tanker",
      flag: "Italy",
      callSign: "ICMD7",
      length: 249,
      beam: 44,
      draught: 14.6,
      latitude: 7.2,
      longitude: 3.4,
      speed: 11.0,
      heading: 305,
      status: "Under way using engine",
      destination: "AUGUSTA",
      eta: isoDateTime(60 * 24 * 11),
      lastUpdated: isoDateTime(-6),
      isMock: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Mock Brent price series — a plausible random walk around ~$80/bbl.
// Deterministic per day so the chart is stable across reloads within a day.
// ---------------------------------------------------------------------------
export function mockPriceSeries(days: number): PricePoint[] {
  const points: PricePoint[] = [];
  let price = 82;
  // Seed from the current day so reloads on the same day are identical.
  let seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const rand = () => {
    // Simple deterministic LCG.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = days - 1; i >= 0; i--) {
    // Mild mean reversion plus noise.
    const drift = (80 - price) * 0.02;
    const shock = (rand() - 0.5) * 2.4;
    price = Math.max(45, Math.min(120, price + drift + shock));
    points.push({ date: isoDate(-i), price: Math.round(price * 100) / 100 });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Mock news headlines
// ---------------------------------------------------------------------------
export function mockNews(): NewsItem[] {
  const items: Array<Omit<NewsItem, "id">> = [
    {
      title:
        "NNPC lifts force majeure on Bonny Light exports as pipeline repairs complete",
      source: "Demo Nigeria Energy Wire",
      url: "https://example.com/nnpc-bonny",
      publishedAt: isoDateTime(-60 * 2),
      description:
        "Loadings at the Bonny terminal resume after weeks of reduced output, easing pressure on Nigerian crude differentials.",
      categories: ["Nigeria", "Crude"],
    },
    {
      title:
        "NUPRC issues new upstream gas flare commercialisation guidelines",
      source: "Demo Nigeria Energy Wire",
      url: "https://example.com/nuprc-flare",
      publishedAt: isoDateTime(-60 * 8),
      description:
        "The upstream regulator's latest guidelines tighten flare-out timelines for producers in the Niger Delta.",
      categories: ["Nigeria", "Gas/LNG", "Regulatory"],
    },
    {
      title: "OPEC+ holds output targets steady as members weigh demand outlook",
      source: "Demo Newswire",
      url: "https://example.com/opec-output",
      publishedAt: isoDateTime(-60 * 3),
      description:
        "Ministers signalled a cautious stance, keeping production quotas unchanged amid mixed signals on global demand.",
      categories: ["OPEC", "Crude"],
    },
    {
      title: "Brent crude steadies above $80 as supply risks offset soft demand",
      source: "Demo Energy Daily",
      url: "https://example.com/brent-steady",
      publishedAt: isoDateTime(-60 * 6),
      description:
        "Prices found support from geopolitical supply concerns even as refining margins narrowed.",
      categories: ["Crude"],
    },
    {
      title: "West African LNG cargoes find firm demand in Europe",
      source: "Demo LNG Report",
      url: "https://example.com/lng-demand",
      publishedAt: isoDateTime(-60 * 12),
      description:
        "Spot LNG shipments from the region tightened as European buyers replenished storage.",
      categories: ["Gas/LNG"],
    },
    {
      title: "Regulator tightens crude export documentation requirements",
      source: "Demo Regulatory Wire",
      url: "https://example.com/reg-update",
      publishedAt: isoDateTime(-60 * 20),
      description:
        "New clearance rules add documentation steps for terminal liftings, effective next quarter.",
      categories: ["Regulatory"],
    },
    {
      title: "Tanker freight rates climb on tighter Atlantic basin tonnage",
      source: "Demo Shipping News",
      url: "https://example.com/freight-rates",
      publishedAt: isoDateTime(-60 * 28),
      description:
        "VLCC and Suezmax rates rose as available tonnage thinned across key loading windows.",
      categories: ["Crude"],
    },
    {
      title: "Natural gas prices ease as mild weather trims heating demand",
      source: "Demo Gas Monitor",
      url: "https://example.com/gas-ease",
      publishedAt: isoDateTime(-60 * 36),
      description:
        "Benchmark gas contracts slipped on a softer near-term demand picture.",
      categories: ["Gas/LNG"],
    },
  ];
  return items.map((it) => ({ ...it, id: randomUUID() }));
}
