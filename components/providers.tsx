"use client";

import * as React from "react";
import { toast } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useCertStore, expiringCount } from "@/lib/stores";

/** Loads certificates once on app start and raises an expiry toast. */
function ExpiryNotifier() {
  const refresh = useCertStore((s) => s.refresh);
  const loaded = useCertStore((s) => s.loaded);
  const certificates = useCertStore((s) => s.certificates);
  const notified = React.useRef(false);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!loaded || notified.current) return;
    notified.current = true;
    const count = expiringCount(certificates);
    if (count > 0) {
      toast.warning(
        `${count} certificate${count > 1 ? "s" : ""} expiring within 30 days`,
        { description: "Open Certificates & Clearances to review them." }
      );
    }
  }, [loaded, certificates]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ExpiryNotifier />
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
