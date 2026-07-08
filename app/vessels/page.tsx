"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Search, Ship } from "lucide-react";
import { PageHeader, EmptyState, ErrorState, DemoBadge } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VesselStatusBadge } from "@/components/vessels/vessel-status-badge";
import type { Vessel } from "@/types";

export default function VesselsPage() {
  const router = useRouter();

  const [vessels, setVessels] = React.useState<Vessel[]>([]);
  const [isMock, setIsMock] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/vessels${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { vessels: Vessel[]; isMock: boolean };
      setVessels(data.vessels);
      setIsMock(data.isMock);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? vessels.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.mmsi.includes(q) ||
          (v.imo ?? "").includes(q) ||
          v.type.toLowerCase().includes(q) ||
          (v.flag ?? "").toLowerCase().includes(q) ||
          (v.destination ?? "").toLowerCase().includes(q)
      )
    : vessels;

  return (
    <div>
      <PageHeader
        title="Vessels"
        description="Browse the fleet, search by name, IMO or MMSI, and open a vessel for full details."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load(true)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by vessel name, IMO, MMSI, type, flag or destination"
                className="pl-9"
                aria-label="Search vessels"
              />
            </div>
            {!loading && !error && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {filtered.length} of {vessels.length} vessel
                  {vessels.length === 1 ? "" : "s"}
                </p>
                {isMock && <DemoBadge />}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              message="Could not load the vessel list."
              onRetry={() => void load()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                q
                  ? "No vessels matched your search. Try a different name, IMO or MMSI."
                  : "No vessels heard on the AIS feed just now. Try refreshing."
              }
              icon={<Ship className="h-8 w-8 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vessel</TableHead>
                    <TableHead>MMSI / IMO</TableHead>
                    <TableHead className="hidden md:table-cell">Flag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      Speed
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Destination
                    </TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow
                      key={v.mmsi}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(`/vessels/${v.mmsi}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/vessels/${v.mmsi}`);
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.type}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.mmsi}
                        {v.imo ? ` / ${v.imo}` : ""}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {v.flag ?? "—"}
                      </TableCell>
                      <TableCell>
                        <VesselStatusBadge
                          status={v.status}
                          className="whitespace-nowrap text-[10px]"
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-xs">
                        {v.speed.toFixed(1)} kn
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {v.destination ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
