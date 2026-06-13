/**
 * Vessel tracking data layer.
 *
 * Live source: AISStream.io — a FREE real-time AIS feed delivered over a
 * WebSocket (NOT a simple REST call). Requires AISSTREAM_API_KEY.
 * Docs: https://aisstream.io/documentation
 *
 * How the live lookup works (see searchLiveVessels below):
 *   1. Open a WebSocket to wss://stream.aisstream.io/v0/stream.
 *   2. Send a subscription message with the API key and a world bounding box,
 *      asking for PositionReport + ShipStaticData messages.
 *   3. Collect messages for a short window (a few seconds), merging static
 *      data (name, IMO, destination, ETA) into position reports keyed by MMSI.
 *   4. Close the socket and return vessels matching the user's query.
 *
 * IMPORTANT COVERAGE CAVEAT: AISStream relies on community-run receivers, so
 * coverage is partial — many open-ocean vessels never appear. When the live
 * lookup finds nothing (or no key is configured), we fall back to a realistic
 * mock dataset so the feature is always demonstrable. Mock rows are badged
 * "Demo data" in the UI.
 */
import type { Vessel, VesselStatus } from "@/types";
import { mockVessels } from "@/lib/mock-data";

const AIS_WS_URL = "wss://stream.aisstream.io/v0/stream";
/** How long to listen on the stream before returning, in ms. */
const COLLECT_WINDOW_MS = 8_000;

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

interface LiveAccumulator {
  mmsi: string;
  name?: string;
  imo?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: number;
  status?: VesselStatus;
  destination?: string;
  eta?: string;
  lastUpdated?: string;
}

function matches(query: string, v: LiveAccumulator | Vessel): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    v.mmsi.toLowerCase().includes(q) ||
    (v.imo ?? "").toLowerCase().includes(q) ||
    (v.name ?? "").toLowerCase().includes(q)
  );
}

/**
 * Listen on the AISStream WebSocket for a short window and return any vessels
 * whose MMSI / IMO / name match the query. Returns [] on any failure so the
 * caller can fall back to mock data.
 */
async function searchLiveVessels(
  apiKey: string,
  query: string
): Promise<Vessel[]> {
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
      for (const v of acc.values()) {
        if (
          v.latitude === undefined ||
          v.longitude === undefined ||
          !matches(query, v)
        ) {
          continue;
        }
        vessels.push({
          mmsi: v.mmsi,
          imo: v.imo,
          name: v.name ?? `MMSI ${v.mmsi}`,
          type: "AIS Vessel",
          latitude: v.latitude,
          longitude: v.longitude,
          speed: v.speed ?? 0,
          heading: v.heading ?? 0,
          status: v.status ?? "Unknown",
          destination: v.destination,
          eta: v.eta,
          lastUpdated: v.lastUpdated ?? new Date().toISOString(),
          isMock: false,
        });
      }
      resolve(vessels);
    };

    const timer = setTimeout(finish, COLLECT_WINDOW_MS);

    try {
      ws = new WebSocket(AIS_WS_URL);
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
            : event.data?.toString?.() ?? "";
        const msg = JSON.parse(raw) as {
          MessageType?: string;
          MetaData?: { MMSI?: number; ShipName?: string };
          Message?: Record<string, any>;
        };
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
          if (!entry.name && msg.MetaData?.ShipName) {
            entry.name = msg.MetaData.ShipName.trim();
          }
        } else if (msg.MessageType === "ShipStaticData") {
          const sd = msg.Message?.ShipStaticData ?? {};
          entry.name = (sd.Name ?? entry.name)?.trim();
          if (sd.ImoNumber) entry.imo = String(sd.ImoNumber);
          entry.destination = sd.Destination?.trim() || entry.destination;
        }
        acc.set(mmsi, entry);
      } catch {
        /* ignore malformed frames */
      }
    };
  });
}

/** Public entry point used by the API route. */
export async function searchVessels(
  query: string
): Promise<{ vessels: Vessel[]; isMock: boolean }> {
  const apiKey = process.env.AISSTREAM_API_KEY?.trim();

  if (apiKey) {
    try {
      const live = await searchLiveVessels(apiKey, query);
      if (live.length > 0) return { vessels: live, isMock: false };
    } catch {
      /* fall through to mock */
    }
  }

  // Fallback: filter the realistic mock fleet by the query.
  const mocks = mockVessels().filter((v) => matches(query, v));
  return { vessels: mocks, isMock: true };
}
