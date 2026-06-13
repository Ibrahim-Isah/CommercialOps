"use client";

/**
 * Lightweight client-side stores (zustand) shared across components.
 *
 * - useCertStore: certificates + computed expiring count, so the top-bar bell
 *   and the Certificates page stay in sync after any create/edit/delete.
 * - useWatchlistStore: the persisted vessel watchlist, shared by the Vessel
 *   Tracking page and the Dashboard map.
 *
 * Both load their data from our own /api/* endpoints (never third-party APIs
 * directly), so keys stay on the server.
 */
import { create } from "zustand";
import type { CertificateWithStatus, Vessel } from "@/types";

interface CertState {
  certificates: CertificateWithStatus[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useCertStore = create<CertState>((set) => ({
  certificates: [],
  loading: false,
  error: null,
  loaded: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/certificates", { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as {
        certificates: CertificateWithStatus[];
      };
      set({
        certificates: data.certificates ?? [],
        loading: false,
        loaded: true,
      });
    } catch {
      set({
        loading: false,
        error: "Could not load certificates.",
        loaded: true,
      });
    }
  },
}));

export function expiringCount(certs: CertificateWithStatus[]): number {
  return certs.filter((c) => c.status === "Expiring Soon").length;
}

interface WatchlistState {
  vessels: Vessel[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  add: (vessel: Vessel) => Promise<void>;
  remove: (mmsi: string) => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>((set) => ({
  vessels: [],
  loading: false,
  error: null,
  loaded: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { vessels: Vessel[] };
      set({ vessels: data.vessels ?? [], loading: false, loaded: true });
    } catch {
      set({ loading: false, error: "Could not load watchlist.", loaded: true });
    }
  },
  add: async (vessel) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vessel }),
    });
    if (res.ok) {
      const data = (await res.json()) as { vessels: Vessel[] };
      set({ vessels: data.vessels ?? [] });
    }
  },
  remove: async (mmsi) => {
    const res = await fetch(`/api/watchlist?mmsi=${encodeURIComponent(mmsi)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = (await res.json()) as { vessels: Vessel[] };
      set({ vessels: data.vessels ?? [] });
    }
  },
}));
