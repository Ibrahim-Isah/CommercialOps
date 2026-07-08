"use client";

import * as React from "react";
import { Ship } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vessel photo keyed by MMSI. AIS itself carries no imagery, so we try the
 * community photo endpoint and fall back to a styled placeholder when no
 * photo exists for the vessel (always the case for demo vessels).
 */
export function VesselImage({
  mmsi,
  name,
  isMock,
  className,
}: {
  mmsi: string;
  name: string;
  /** Demo vessels have made-up MMSIs that could collide with real ships. */
  isMock?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [mmsi]);

  if (isMock || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 text-slate-400",
          className
        )}
      >
        <Ship className="h-10 w-10" />
        <p className="px-4 text-center text-xs">
          {isMock
            ? `${name} is a demo vessel — no photo`
            : `No photo available for ${name}`}
        </p>
      </div>
    );
  }

  return (
    // External host with unpredictable availability; a plain <img> lets
    // onError drive the fallback, which next/image does not support well.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://photos.marinetraffic.com/ais/showphoto.aspx?mmsi=${encodeURIComponent(mmsi)}`}
      alt={`Photo of ${name}`}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
