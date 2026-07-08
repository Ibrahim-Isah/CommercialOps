"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Ship } from "lucide-react";
import { PageHeader, EmptyState, ErrorState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VesselImage } from "@/components/vessels/vessel-image";
import { VesselStatusBadge } from "@/components/vessels/vessel-status-badge";
import type { Vessel } from "@/types";

// Leaflet touches window/document, so load the map client-side only.
const VesselMap = dynamic(() => import("@/components/vessels/vessel-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

function Field({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default function VesselDetailPage() {
  const params = useParams<{ mmsi: string }>();
  const mmsi = params.mmsi;

  const [vessel, setVessel] = React.useState<Vessel | null>(null);
  const [isMock, setIsMock] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/vessels/${encodeURIComponent(mmsi)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { vessel: Vessel; isMock: boolean };
      setVessel(data.vessel);
      setIsMock(data.isMock);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mmsi]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
      <Link href="/vessels">
        <ArrowLeft className="mr-2 h-4 w-4" />
        All vessels
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <Skeleton className="mb-6 h-16 w-72" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64 lg:col-span-3" />
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <EmptyState
          message={`No vessel with MMSI ${mmsi} was heard recently. AIS coverage is partial — the vessel may be outside receiver range. Go back and pick another vessel or refresh the list.`}
          icon={<Ship className="h-8 w-8 text-muted-foreground" />}
        />
      </div>
    );
  }

  if (error || !vessel) {
    return (
      <div>
        {backLink}
        <ErrorState
          message="Could not load this vessel's details."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div>
      {backLink}
      <PageHeader
        title={vessel.name}
        description={[vessel.type, vessel.flag].filter(Boolean).join(" · ")}
      >
        <VesselStatusBadge status={vessel.status} />
        {isMock && <DemoBadge />}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          <VesselImage
            mmsi={vessel.mmsi}
            name={vessel.name}
            isMock={vessel.isMock}
            className="h-56 w-full"
          />
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">
              Community-sourced photo — not available for every vessel.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vessel particulars
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Field label="MMSI" value={vessel.mmsi} />
              <Field label="IMO" value={vessel.imo} />
              <Field label="Call sign" value={vessel.callSign} />
              <Field label="Type" value={vessel.type} />
              <Field label="Flag" value={vessel.flag} />
              <Field
                label="Length overall"
                value={vessel.length ? `${vessel.length} m` : undefined}
              />
              <Field
                label="Beam"
                value={vessel.beam ? `${vessel.beam} m` : undefined}
              />
              <Field
                label="Max draught"
                value={vessel.draught ? `${vessel.draught.toFixed(1)} m` : undefined}
              />
              <Field
                label="Last AIS update"
                value={`${formatDistanceToNow(new Date(vessel.lastUpdated))} ago`}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Voyage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Destination" value={vessel.destination} />
              <Field
                label="ETA"
                value={
                  vessel.eta
                    ? format(new Date(vessel.eta), "d MMM yyyy, HH:mm")
                    : undefined
                }
              />
              <Field label="Speed" value={`${vessel.speed.toFixed(1)} kn`} />
              <Field label="Course" value={`${Math.round(vessel.heading)}°`} />
              <Field
                label="Position"
                value={`${vessel.latitude.toFixed(4)}, ${vessel.longitude.toFixed(4)}`}
              />
              <Field
                label="Navigational status"
                value={<VesselStatusBadge status={vessel.status} />}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last known position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full overflow-hidden rounded-lg border">
              <VesselMap vessels={[vessel]} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
