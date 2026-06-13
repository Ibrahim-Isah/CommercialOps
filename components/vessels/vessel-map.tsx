"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import type { Vessel } from "@/types";

/**
 * Build a small rotated arrow marker via divIcon. Using a divIcon avoids the
 * well-known Leaflet "missing marker image" problem in bundlers entirely.
 */
function vesselIcon(mock: boolean) {
  const colour = mock ? "#f59e0b" : "#0ea5e9";
  const html =
    '<div style="width:16px;height:16px;border-radius:50%;background:' +
    colour +
    ';border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.35);"></div>';
  return L.divIcon({
    className: "vessel-marker",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Pan/zoom to fit all vessels whenever the set changes. */
function FitBounds({ vessels }: { vessels: Vessel[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (vessels.length === 0) return;
    if (vessels.length === 1) {
      map.setView([vessels[0].latitude, vessels[0].longitude], 6);
      return;
    }
    const bounds = L.latLngBounds(
      vessels.map((v): [number, number] => [v.latitude, v.longitude])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }, [vessels, map]);
  return null;
}

export default function VesselMap({ vessels }: { vessels: Vessel[] }) {
  const center: [number, number] =
    vessels.length > 0
      ? [vessels[0].latitude, vessels[0].longitude]
      : [4.5, 6.5]; // Gulf of Guinea default.

  return (
    <MapContainer
      center={center}
      zoom={4}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds vessels={vessels} />
      {vessels.map((v) => (
        <Marker
          key={v.mmsi}
          position={[v.latitude, v.longitude]}
          icon={vesselIcon(v.isMock)}
        >
          <Popup>
            <div className="space-y-1 text-xs">
              <p className="text-sm font-semibold">{v.name}</p>
              <p>
                {v.type}
                {v.flag ? ` · ${v.flag}` : ""}
              </p>
              <p>MMSI {v.mmsi}{v.imo ? ` · IMO ${v.imo}` : ""}</p>
              <p>
                {v.latitude.toFixed(3)}, {v.longitude.toFixed(3)}
              </p>
              <p>
                {v.speed.toFixed(1)} kn · {Math.round(v.heading)}° · {v.status}
              </p>
              {v.destination && <p>Dest: {v.destination}</p>}
              {v.eta && (
                <p>ETA: {format(new Date(v.eta), "d MMM yyyy, HH:mm")}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
