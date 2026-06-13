"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { Search, Plus, Trash2, Ship, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWatchlistStore } from "@/lib/stores";
import type { Vessel } from "@/types";

// Leaflet touches window/document, so load the map client-side only.
const VesselMap = dynamic(() => import("@/components/vessels/vessel-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function VesselsPage() {
  const { vessels: watchlist, loaded, refresh, add, remove } =
    useWatchlistStore();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Vessel[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [resultsMock, setResultsMock] = React.useState(false);

  React.useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/vessels?q=${encodeURIComponent(query.trim())}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { vessels: Vessel[]; isMock: boolean };
      setResults(data.vessels);
      setResultsMock(data.isMock);
    } catch {
      toast.error("Vessel search failed. Please try again.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const watchedMmsi = new Set(watchlist.map((v) => v.mmsi));

  async function addVessel(v: Vessel) {
    await add(v);
    toast.success(`${v.name} added to watchlist.`);
  }

  return (
    <div>
      <PageHeader
        title="Vessel Tracking"
        description="Search live AIS or the demo fleet, then watch vessels on the map."
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by vessel name, IMO or MMSI"
                className="pl-9"
                aria-label="Search vessels"
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </form>

          {searched && (
            <div className="mt-4">
              {searching ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <EmptyState message="No vessels matched your search. Try a different name, IMO or MMSI." />
              ) : (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {results.length} result{results.length > 1 ? "s" : ""}
                    </p>
                    {resultsMock && <DemoBadge />}
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vessel</TableHead>
                          <TableHead>MMSI / IMO</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead className="text-right">Watch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((v) => (
                          <TableRow key={v.mmsi}>
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
                            <TableCell className="text-xs">{v.status}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {v.destination ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={watchedMmsi.has(v.mmsi)}
                                onClick={() => void addVessel(v)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                {watchedMmsi.has(v.mmsi) ? "Added" : "Add"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Watchlist map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[420px] w-full overflow-hidden rounded-lg border">
              {watchlist.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    message="Add vessels to your watchlist to see them on the map."
                    icon={<Ship className="h-8 w-8 text-muted-foreground" />}
                  />
                </div>
              ) : (
                <VesselMap vessels={watchlist} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tracked vessels ({watchlist.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {watchlist.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing tracked yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {watchlist.map((v) => (
                  <li
                    key={v.mmsi}
                    className="flex items-start justify-between gap-2 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{v.name}</span>
                        {v.isMock && (
                          <Badge variant="warning" className="text-[10px]">
                            Demo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.speed.toFixed(1)} kn · {Math.round(v.heading)}° ·{" "}
                        {v.status}
                      </p>
                      {v.eta && (
                        <p className="text-xs text-muted-foreground">
                          ETA {format(new Date(v.eta), "d MMM, HH:mm")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${v.name}`}
                      onClick={() => void remove(v.mmsi)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
