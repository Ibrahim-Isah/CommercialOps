/**
 * Vessel data layer — fleet browsing + per-vessel details.
 *
 * Live source: AISStream.io — a FREE real-time AIS feed delivered over a
 * WebSocket (NOT a simple REST call). Requires AISSTREAM_API_KEY.
 * Docs: https://aisstream.io/documentation
 *
 * Browsing model:
 *   - getFleet() opens the stream for a short window, collects every vessel
 *     heard (position reports merged with static data keyed by MMSI), caches
 *     the snapshot, and returns it as a browsable list.
 *   - getVessel(mmsi) serves a single vessel from the recently-seen pool,
 *     the mock fleet, or a fresh collection window.
 *
 * IMPORTANT COVERAGE CAVEAT: AISStream relies on community-run receivers, so
 * coverage is partial and each collection window hears a different slice of
 * the world fleet. When the live lookup finds nothing (or no key is
 * configured), we fall back to a realistic mock fleet so the feature is
 * always demonstrable. Mock rows are badged "Demo data" in the UI.
 */
import type { Vessel, VesselStatus } from "@/types";
import { mockVessels } from "@/lib/mock-data";
import { getCached, setCached } from "@/lib/cache";

const AIS_WS_URL = "wss://stream.aisstream.io/v0/stream";
/** How long to listen on the stream before returning, in ms. */
const COLLECT_WINDOW_MS = 8_000;
/** How long a collected fleet snapshot stays fresh, in ms. */
const FLEET_TTL_MS = 3 * 60_000;
/** How long an individual vessel stays resolvable after being heard, in ms. */
const SEEN_TTL_MS = 30 * 60_000;
/** Cap the list so a busy stream window stays a browsable page. */
const FLEET_MAX = 120;

const FLEET_CACHE_KEY = "vessels:fleet";

/**
 * Vessels heard on any recent collection window, kept longer than the fleet
 * snapshot so a detail page opened from the list can still resolve its vessel
 * after the snapshot expires. Anchored on globalThis because Next.js bundles
 * each API route separately — a module-level Map would not be shared between
 * the list route and the detail route.
 */
const g = globalThis as unknown as {
  __seenVessels?: Map<string, { vessel: Vessel; expires: number }>;
};
const seenVessels = (g.__seenVessels ??= new Map());

function rememberVessel(v: Vessel): void {
  seenVessels.set(v.mmsi, { vessel: v, expires: Date.now() + SEEN_TTL_MS });
}

function recallVessel(mmsi: string): Vessel | undefined {
  const entry = seenVessels.get(mmsi);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    seenVessels.delete(mmsi);
    return undefined;
  }
  return entry.vessel;
}

// AIS navigational-status code -> human label.
const NAV_STATUS: Record<number, VesselStatus> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuvrability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
};

function mapNavStatus(code: unknown): VesselStatus {
  if (typeof code === "number" && NAV_STATUS[code]) return NAV_STATUS[code];
  return "Unknown";
}

/** AIS ship-type code (ShipStaticData.Type) -> human label. */
function mapShipType(code: unknown): string | undefined {
  if (typeof code !== "number" || code <= 0) return undefined;
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 70 && code <= 79) return "Cargo Ship";
  if (code >= 60 && code <= 69) return "Passenger Ship";
  if (code >= 40 && code <= 49) return "High-Speed Craft";
  switch (code) {
    case 30:
      return "Fishing Vessel";
    case 31:
    case 32:
      return "Towing Vessel";
    case 33:
      return "Dredger";
    case 35:
      return "Military Ops";
    case 36:
      return "Sailing Vessel";
    case 37:
      return "Pleasure Craft";
    case 50:
      return "Pilot Vessel";
    case 51:
      return "Search & Rescue";
    case 52:
      return "Tug";
    case 53:
      return "Port Tender";
    case 55:
      return "Law Enforcement";
  }
  return "Other";
}

/**
 * AIS ETA carries only month/day/hour/minute (no year); 0-month/0-day and
 * hour 24 mean "unavailable". Assume the next occurrence of that date.
 */
function parseEta(eta: unknown): string | undefined {
  const e = eta as
    | { Month?: number; Day?: number; Hour?: number; Minute?: number }
    | undefined;
  if (!e?.Month || !e.Day) return undefined;
  const now = new Date();
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      e.Month - 1,
      e.Day,
      e.Hour && e.Hour < 24 ? e.Hour : 0,
      e.Minute && e.Minute < 60 ? e.Minute : 0
    )
  );
  if (Number.isNaN(d.getTime())) return undefined;
  // More than a week in the past -> the ETA wraps into next year.
  if (d.getTime() < now.getTime() - 7 * 24 * 3_600_000) {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  }
  return d.toISOString();
}

interface LiveAccumulator {
  mmsi: string;
  name?: string;
  imo?: string;
  callSign?: string;
  type?: string;
  length?: number;
  beam?: number;
  draught?: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: number;
  status?: VesselStatus;
  destination?: string;
  eta?: string;
  lastUpdated?: string;
}

function matches(query: string, v: Vessel): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    v.mmsi.toLowerCase().includes(q) ||
    (v.imo ?? "").toLowerCase().includes(q) ||
    v.name.toLowerCase().includes(q) ||
    v.type.toLowerCase().includes(q) ||
    (v.flag ?? "").toLowerCase().includes(q) ||
    (v.destination ?? "").toLowerCase().includes(q)
  );
}

export { matches as matchesVesselQuery };

function toVessel(v: LiveAccumulator): Vessel | undefined {
  if (v.latitude === undefined || v.longitude === undefined) return undefined;
  return {
    mmsi: v.mmsi,
    imo: v.imo,
    name: v.name ?? `MMSI ${v.mmsi}`,
    type: v.type ?? "Vessel",
    callSign: v.callSign,
    length: v.length,
    beam: v.beam,
    draught: v.draught,
    latitude: v.latitude,
    longitude: v.longitude,
    speed: v.speed ?? 0,
    heading: v.heading ?? 0,
    status: v.status ?? "Unknown",
    destination: v.destination,
    eta: v.eta,
    lastUpdated: v.lastUpdated ?? new Date().toISOString(),
    isMock: false,
  };
}

/**
 * Listen on the AISStream WebSocket for a short window and return every
 * vessel heard with a usable position. Also refreshes the recently-seen pool.
 * Returns [] on any failure so callers can fall back to mock data.
 */
async function collectLiveFleet(apiKey: string): Promise<Vessel[]> {
  // Node 18+/22 exposes a global WebSocket. Guard in case it is unavailable.
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    return [];
  }

  return new Promise<Vessel[]>((resolve) => {
    const acc = new Map<string, LiveAccumulator>();
    let settled = false;
    let ws: WebSocket;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      const vessels: Vessel[] = [];
      acc.forEach((entry) => {
        const vessel = toVessel(entry);
        if (!vessel) return;
        rememberVessel(vessel);
        vessels.push(vessel);
      });
      resolve(vessels);
    };

    const timer = setTimeout(finish, COLLECT_WINDOW_MS);

    try {
      ws = new WebSocket(AIS_WS_URL);
      // AISStream sends binary frames; without this they arrive as Blobs,
      // which cannot be parsed synchronously in onmessage.
      ws.binaryType = "arraybuffer";
    } catch {
      clearTimeout(timer);
      resolve([]);
      return;
    }

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          // Whole-world bounding box; community coverage does the filtering.
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180],
            ],
          ],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        })
      );
    };

    ws.onerror = () => {
      clearTimeout(timer);
      finish();
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        const msg = JSON.parse(raw) as {
          error?: string;
          MessageType?: string;
          MetaData?: { MMSI?: number; ShipName?: string };
          Message?: Record<string, any>;
        };
        // AISStream reports subscription problems (e.g. a bad API key) as an
        // error frame; waiting out the window would only return nothing.
        if (msg.error) {
          console.warn(`AISStream subscription error: ${msg.error}`);
          clearTimeout(timer);
          finish();
          return;
        }
        const mmsi = msg.MetaData?.MMSI?.toString();
        if (!mmsi) return;
        const entry = acc.get(mmsi) ?? { mmsi };

        if (msg.MessageType === "PositionReport") {
          const pr = msg.Message?.PositionReport ?? {};
          entry.latitude = pr.Latitude ?? entry.latitude;
          entry.longitude = pr.Longitude ?? entry.longitude;
          entry.speed = pr.Sog ?? entry.speed;
          entry.heading = pr.Cog ?? entry.heading;
          entry.status = mapNavStatus(pr.NavigationalStatus);
          entry.lastUpdated = new Date().toISOString();
        } else if (msg.MessageType === "ShipStaticData") {
          const sd = msg.Message?.ShipStaticData ?? {};
          entry.name = (sd.Name ?? entry.name)?.trim();
          if (sd.ImoNumber) entry.imo = String(sd.ImoNumber);
          if (sd.CallSign?.trim()) entry.callSign = sd.CallSign.trim();
          entry.type = mapShipType(sd.Type) ?? entry.type;
          // Dimension A/B are metres to bow/stern, C/D to port/starboard.
          const dim = sd.Dimension ?? {};
          const length = (dim.A ?? 0) + (dim.B ?? 0);
          const beam = (dim.C ?? 0) + (dim.D ?? 0);
          if (length > 0) entry.length = length;
          if (beam > 0) entry.beam = beam;
          if (sd.MaximumStaticDraught > 0) {
            entry.draught = sd.MaximumStaticDraught;
          }
          entry.destination = sd.Destination?.trim() || entry.destination;
          entry.eta = parseEta(sd.Eta) ?? entry.eta;
        }
        // Every AISStream frame carries the ship name in its metadata, so
        // names resolve even when no static-data frame arrives in the window.
        if (!entry.name && msg.MetaData?.ShipName?.trim()) {
          entry.name = msg.MetaData.ShipName.trim();
        }
        acc.set(mmsi, entry);
      } catch {
        /* ignore malformed frames */
      }
    };
  });
}

/** Named vessels first, then alphabetical, capped to a browsable page. */
function toBrowsableList(vessels: Vessel[]): Vessel[] {
  return [...vessels]
    .sort((a, b) => {
      const aNamed = a.name.startsWith("MMSI ") ? 1 : 0;
      const bNamed = b.name.startsWith("MMSI ") ? 1 : 0;
      if (aNamed !== bNamed) return aNamed - bNamed;
      return a.name.localeCompare(b.name);
    })
    .slice(0, FLEET_MAX);
}

/** GET the browsable fleet list — cached live snapshot or the mock fleet. */
export async function getFleet(options?: {
  forceRefresh?: boolean;
}): Promise<{ vessels: Vessel[]; isMock: boolean }> {
  const apiKey = process.env.AISSTREAM_API_KEY?.trim();

  if (apiKey) {
    if (!options?.forceRefresh) {
      const cached = getCached<Vessel[]>(FLEET_CACHE_KEY);
      if (cached && cached.length > 0) {
        return { vessels: cached, isMock: false };
      }
    }
    try {
      const live = await collectLiveFleet(apiKey);
      if (live.length > 0) {
        const list = toBrowsableList(live);
        setCached(FLEET_CACHE_KEY, list, FLEET_TTL_MS);
        return { vessels: list, isMock: false };
      }
    } catch {
      /* fall through to mock */
    }
  }

  const mocks = [...mockVessels()].sort((a, b) => a.name.localeCompare(b.name));
  return { vessels: mocks, isMock: true };
}

/**
 * Resolve one vessel by MMSI: recently-seen live pool first, then the mock
 * fleet, then one fresh collection window. Returns null when unheard.
 */
export async function getVessel(
  mmsi: string
): Promise<{ vessel: Vessel; isMock: boolean } | null> {
  const seen = recallVessel(mmsi);
  if (seen) return { vessel: seen, isMock: false };

  const mock = mockVessels().find((v) => v.mmsi === mmsi);
  if (mock) return { vessel: mock, isMock: true };

  const apiKey = process.env.AISSTREAM_API_KEY?.trim();
  if (apiKey) {
    try {
      await collectLiveFleet(apiKey); // refreshes the recently-seen pool
      const heard = recallVessel(mmsi);
      if (heard) return { vessel: heard, isMock: false };
    } catch {
      /* fall through */
    }
  }
  return null;
}
