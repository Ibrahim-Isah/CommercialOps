import type { CertificateCategory, CertificateInput } from "@/types";

const CATEGORIES: CertificateCategory[] = [
  "Regulatory",
  "Operational",
  "Insurance",
  "Vessel",
  "Environmental",
  "Other",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate and normalise a certificate payload. Returns either data or error. */
export function parseCertificateInput(
  body: unknown
): { data: CertificateInput } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required." };

  const issuingBody =
    typeof b.issuingBody === "string" ? b.issuingBody.trim() : "";
  if (!issuingBody) return { error: "Issuing body is required." };

  const category = b.category as CertificateCategory;
  if (!CATEGORIES.includes(category)) {
    return { error: "A valid category is required." };
  }

  const registrationDate =
    typeof b.registrationDate === "string" ? b.registrationDate : "";
  const expirationDate =
    typeof b.expirationDate === "string" ? b.expirationDate : "";
  if (!ISO_DATE.test(registrationDate)) {
    return { error: "Registration date must be a valid date." };
  }
  if (!ISO_DATE.test(expirationDate)) {
    return { error: "Expiration date must be a valid date." };
  }
  if (new Date(expirationDate) <= new Date(registrationDate)) {
    return { error: "Expiration date must be after the registration date." };
  }

  const notes = typeof b.notes === "string" ? b.notes.trim() : undefined;

  return {
    data: { name, issuingBody, category, registrationDate, expirationDate, notes },
  };
}
