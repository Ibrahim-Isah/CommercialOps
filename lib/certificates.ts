import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  Certificate,
  CertificateStatus,
  CertificateWithStatus,
} from "@/types";

/** Number of days within which a certificate counts as "Expiring Soon". */
export const EXPIRY_WINDOW_DAYS = 30;

/**
 * Compute status from an expiration date relative to "now".
 * Expired if past; Expiring Soon if within EXPIRY_WINDOW_DAYS; else Active.
 */
export function computeStatus(
  expirationDate: string,
  now: Date = new Date()
): { status: CertificateStatus; daysRemaining: number } {
  const days = differenceInCalendarDays(parseISO(expirationDate), now);
  if (days < 0) return { status: "Expired", daysRemaining: days };
  if (days <= EXPIRY_WINDOW_DAYS)
    return { status: "Expiring Soon", daysRemaining: days };
  return { status: "Active", daysRemaining: days };
}

export function withStatus(
  cert: Certificate,
  now: Date = new Date()
): CertificateWithStatus {
  const { status, daysRemaining } = computeStatus(cert.expirationDate, now);
  return { ...cert, status, daysRemaining };
}

export function decorate(
  certs: Certificate[],
  now: Date = new Date()
): CertificateWithStatus[] {
  return certs.map((c) => withStatus(c, now));
}

/** Items expiring within the window (and not already expired), soonest first. */
export function expiringSoon(
  certs: Certificate[],
  now: Date = new Date()
): CertificateWithStatus[] {
  return decorate(certs, now)
    .filter((c) => c.status === "Expiring Soon")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}
