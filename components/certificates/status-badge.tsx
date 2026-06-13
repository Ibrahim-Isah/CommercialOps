import { Badge } from "@/components/ui/badge";
import type { CertificateStatus } from "@/types";

export function StatusBadge({ status }: { status: CertificateStatus }) {
  if (status === "Expired") return <Badge variant="destructive">Expired</Badge>;
  if (status === "Expiring Soon")
    return <Badge variant="warning">Expiring Soon</Badge>;
  return <Badge variant="success">Active</Badge>;
}
