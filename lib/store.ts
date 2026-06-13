/**
 * Tiny JSON-file data store.
 *
 * We deliberately use a single JSON file instead of SQLite/better-sqlite3:
 * better-sqlite3 needs native compilation, which is a common source of install
 * friction (especially on Windows). A JSON file is zero-dependency and reliable
 * for a single-user internal tool. ALL persistence logic lives in this one
 * module, so it can be swapped for Postgres/SQLite later without touching the
 * API routes — they only call the exported functions.
 *
 * Persists: certificates and the vessel watchlist.
 * File: <project>/data/store.json (git-ignored).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Certificate, CertificateInput, Vessel } from "@/types";
import { seedCertificates } from "@/lib/mock-data";

interface StoreShape {
  certificates: Certificate[];
  watchlist: Vessel[];
  seeded: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function emptyStore(): StoreShape {
  return { certificates: [], watchlist: [], seeded: false };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): StoreShape {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) {
      return emptyStore();
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      certificates: parsed.certificates ?? [],
      watchlist: parsed.watchlist ?? [],
      seeded: parsed.seeded ?? false,
    };
  } catch {
    // Corrupt or unreadable file — fall back to empty rather than crashing.
    return emptyStore();
  }
}

function writeStore(store: StoreShape) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/** Seed example certificates the first time the store is touched. */
function getSeededStore(): StoreShape {
  const store = readStore();
  if (!store.seeded) {
    store.certificates = seedCertificates();
    store.seeded = true;
    writeStore(store);
  }
  return store;
}

// --- Certificates ----------------------------------------------------------

export function listCertificates(): Certificate[] {
  return getSeededStore().certificates;
}

export function getCertificate(id: string): Certificate | undefined {
  return getSeededStore().certificates.find((c) => c.id === id);
}

export function createCertificate(input: CertificateInput): Certificate {
  const store = getSeededStore();
  const now = new Date().toISOString();
  const cert: Certificate = {
    id: randomUUID(),
    ...input,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  store.certificates.push(cert);
  writeStore(store);
  return cert;
}

export function updateCertificate(
  id: string,
  input: CertificateInput
): Certificate | undefined {
  const store = getSeededStore();
  const idx = store.certificates.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const existing = store.certificates[idx];
  const updated: Certificate = {
    ...existing,
    ...input,
    notes: input.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  store.certificates[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteCertificate(id: string): boolean {
  const store = getSeededStore();
  const before = store.certificates.length;
  store.certificates = store.certificates.filter((c) => c.id !== id);
  if (store.certificates.length === before) return false;
  writeStore(store);
  return true;
}

// --- Vessel watchlist -------------------------------------------------------

export function listWatchlist(): Vessel[] {
  return getSeededStore().watchlist;
}

export function addToWatchlist(vessel: Vessel): Vessel[] {
  const store = getSeededStore();
  const exists = store.watchlist.some((v) => v.mmsi === vessel.mmsi);
  if (!exists) {
    store.watchlist.push(vessel);
    writeStore(store);
  } else {
    // Refresh the stored snapshot with the latest position.
    store.watchlist = store.watchlist.map((v) =>
      v.mmsi === vessel.mmsi ? vessel : v
    );
    writeStore(store);
  }
  return store.watchlist;
}

export function removeFromWatchlist(mmsi: string): Vessel[] {
  const store = getSeededStore();
  store.watchlist = store.watchlist.filter((v) => v.mmsi !== mmsi);
  writeStore(store);
  return store.watchlist;
}
