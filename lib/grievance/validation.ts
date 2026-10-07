/**
 * Request-body validation for the grievance API routes, following the
 * shape of lib/supply-chain/validation.ts: return { data } or { error }.
 */
import type {
  GrievanceArea,
  GrievanceCategory,
  GrievanceChannel,
  GrievanceComplainantType,
  GrievanceInput,
  GrievanceNature,
  GrievanceSeverity,
} from "@/types";

export const GRIEVANCE_CATEGORIES: GrievanceCategory[] = [
  "Environmental Concerns",
  "Gas Flaring",
  "Land Degradation",
  "Community Displacement",
  "Cultural Heritage",
  "Compensation",
  "Local Employment",
  "Community Development Projects",
  "Community Recognition",
  "Delayed Payments",
];

export const GRIEVANCE_NATURES: GrievanceNature[] = [
  "Encroachment",
  "Flooding",
  "Blasting (noise, vibration)",
  "Soil erosion",
  "Oil spill",
  "Access road",
  "Land acquisition",
  "Material transportation and use",
  "Water pollution",
  "Gas flaring",
  "MoUs",
  "Property damage (farmland, assets)",
  "Other",
];

export const GRIEVANCE_SEVERITIES: GrievanceSeverity[] = ["Low", "Medium", "High"];

export const GRIEVANCE_COMPLAINANT_TYPES: GrievanceComplainantType[] = [
  "Individual",
  "Group",
  "Community",
];

export const GRIEVANCE_CHANNELS: GrievanceChannel[] = [
  "Email",
  "Written Letter",
  "Phone Call",
  "SMS",
  "WhatsApp",
  "In-Person Engagement",
  "Office Visit",
];

export const GRIEVANCE_AREAS: GrievanceArea[] = [
  "Land Area",
  "Swamp Area",
  "Port Harcourt Office",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Result<T> = { data: T } | { error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optStr(v: unknown): string | undefined {
  const s = str(v);
  return s || undefined;
}

function bool(v: unknown): boolean {
  return v === true;
}

export function parseGrievanceInput(body: unknown): Result<GrievanceInput> {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be an object." };
  }
  const b = body as Record<string, unknown>;

  const title = str(b.title);
  if (!title) return { error: "Title is required." };

  const category = b.category as GrievanceCategory;
  if (!GRIEVANCE_CATEGORIES.includes(category)) {
    return { error: "A valid category is required." };
  }
  const nature = b.nature as GrievanceNature;
  if (!GRIEVANCE_NATURES.includes(nature)) {
    return { error: "A valid nature of complaint is required." };
  }
  const severity = (b.severity ?? "Low") as GrievanceSeverity;
  if (!GRIEVANCE_SEVERITIES.includes(severity)) {
    return { error: "A valid severity is required." };
  }

  const complainantName = str(b.complainantName);
  if (!complainantName) return { error: "The complainant's name is required." };
  const complainantType = (b.complainantType ?? "Individual") as GrievanceComplainantType;
  if (!GRIEVANCE_COMPLAINANT_TYPES.includes(complainantType)) {
    return { error: "A valid complainant type is required." };
  }

  const area = b.area as GrievanceArea;
  if (!GRIEVANCE_AREAS.includes(area)) {
    return { error: "A valid operational area is required." };
  }
  const medium = b.medium as GrievanceChannel;
  if (!GRIEVANCE_CHANNELS.includes(medium)) {
    return { error: "A valid submission channel is required." };
  }

  const dateOfComplaint = str(b.dateOfComplaint);
  const dateReceived = str(b.dateReceived);
  if (!ISO_DATE.test(dateOfComplaint)) {
    return { error: "The date the complaint occurred is required." };
  }
  if (!ISO_DATE.test(dateReceived)) {
    return { error: "The date of receipt is required." };
  }
  if (new Date(dateReceived) < new Date(dateOfComplaint)) {
    return { error: "The date of receipt cannot precede the complaint date." };
  }

  const registeringOfficer = str(b.registeringOfficer);
  if (!registeringOfficer) {
    return { error: "The registering officer is required." };
  }

  const targetResolutionDate = optStr(b.targetResolutionDate);
  if (targetResolutionDate && !ISO_DATE.test(targetResolutionDate)) {
    return { error: "The target resolution date must be a valid date." };
  }

  return {
    data: {
      title,
      description: optStr(b.description),
      category,
      nature,
      severity,
      humanRightsRelated: bool(b.humanRightsRelated),
      sensitive: bool(b.sensitive),
      complainantName,
      complainantType,
      complainantContact: optStr(b.complainantContact),
      stakeholderGroup: optStr(b.stakeholderGroup),
      state: optStr(b.state),
      lga: optStr(b.lga),
      community: optStr(b.community),
      area,
      medium,
      dateOfComplaint,
      dateReceived,
      registeringOfficer,
      documentation: optStr(b.documentation),
      responsibleDepartment: optStr(b.responsibleDepartment),
      responsiblePerson: optStr(b.responsiblePerson),
      actionRequired: optStr(b.actionRequired),
      targetResolutionDate,
      remarks: optStr(b.remarks),
    },
  };
}