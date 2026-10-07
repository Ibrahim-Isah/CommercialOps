import { describe, expect, it } from "vitest";
import { decorate, isSettled, stepIndex, withMeta } from "@/lib/grievance/derive";
import { parseGrievanceInput } from "@/lib/grievance/validation";
import type { Grievance, GrievanceInput } from "@/types";

function makeGrievance(overrides: Partial<Grievance> = {}): Grievance {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    referenceNumber: "GRV-2026-0001",
    title: "Crude spill affecting farmland",
    category: "Environmental Concerns",
    nature: "Oil spill",
    severity: "Medium",
    humanRightsRelated: false,
    sensitive: false,
    complainantName: "Chief Eze",
    complainantType: "Community",
    area: "Land Area",
    medium: "In-Person Engagement",
    dateOfComplaint: "2026-01-10",
    dateReceived: "2026-01-12",
    registeringOfficer: "A. Bello",
    rapidResponse: false,
    litigation: false,
    step: "Receive & Register",
    status: "Open",
    createdAt: "2026-01-12T10:00:00Z",
    updatedAt: "2026-01-12T10:00:00Z",
    ...overrides,
  };
}

describe("derive: case metadata", () => {
  const now = new Date("2026-01-20T00:00:00Z");

  it("marks an open case past its target as overdue", () => {
    const g = withMeta(makeGrievance({ targetResolutionDate: "2026-01-15" }), now);
    expect(g.overdue).toBe(true);
    expect(g.daysToTarget).toBe(-5);
    expect(g.daysOpen).toBe(8);
  });

  it("does not flag overdue when the target is in the future", () => {
    const g = withMeta(makeGrievance({ targetResolutionDate: "2026-01-25" }), now);
    expect(g.overdue).toBe(false);
  });

  it("stops the overdue clock once the case is settled", () => {
    const g = withMeta(
      makeGrievance({ targetResolutionDate: "2026-01-15", status: "Resolved" }),
      now
    );
    expect(g.overdue).toBe(false);
  });

  it("treats Resolved, Closed and Abandoned as settled", () => {
    expect(isSettled({ status: "Resolved" })).toBe(true);
    expect(isSettled({ status: "Closed" })).toBe(true);
    expect(isSettled({ status: "Abandoned" })).toBe(true);
    expect(isSettled({ status: "Open" })).toBe(false);
  });

  it("decorates lists consistently", () => {
    const list = decorate([makeGrievance(), makeGrievance({ id: "x", status: "Closed" })], now);
    expect(list).toHaveLength(2);
    expect(list[0].overdue).toBe(false);
    expect(list[1].status).toBe("Closed");
  });
});

describe("derive: process ladder (Figure 1)", () => {
  it("orders the six process steps", () => {
    expect(stepIndex("Receive & Register")).toBe(0);
    expect(stepIndex("Acknowledge")).toBe(1);
    expect(stepIndex("Assess & Assign")).toBe(2);
    expect(stepIndex("Investigate")).toBe(3);
    expect(stepIndex("Respond")).toBe(4);
    expect(stepIndex("Follow-Up & Close")).toBe(5);
  });
});

describe("parseGrievanceInput", () => {
  const valid: GrievanceInput = {
    title: "Oil spill at Ogale",
    category: "Environmental Concerns",
    nature: "Oil spill",
    severity: "High",
    humanRightsRelated: true,
    sensitive: true,
    complainantName: "Friday Nwosu",
    complainantType: "Individual",
    area: "Land Area",
    medium: "WhatsApp",
    dateOfComplaint: "2026-02-01",
    dateReceived: "2026-02-03",
    registeringOfficer: "GO Peterside",
  };

  it("accepts a minimal valid payload", () => {
    const result = parseGrievanceInput(valid);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.title).toBe("Oil spill at Ogale");
      expect(result.data.humanRightsRelated).toBe(true);
    }
  });

  it("requires title, complainant and registering officer", () => {
    for (const field of ["title", "complainantName", "registeringOfficer"] as const) {
      const result = parseGrievanceInput({ ...valid, [field]: "" });
      expect("error" in result).toBe(true);
    }
  });

  it("rejects unknown category / nature / channel values", () => {
    expect("error" in parseGrievanceInput({ ...valid, category: "Junk" })).toBe(true);
    expect("error" in parseGrievanceInput({ ...valid, nature: "Junk" })).toBe(true);
    expect("error" in parseGrievanceInput({ ...valid, medium: "Telepathy" })).toBe(true);
  });

  it("rejects a receipt date before the complaint date", () => {
    const result = parseGrievanceInput({
      ...valid,
      dateOfComplaint: "2026-02-05",
      dateReceived: "2026-02-03",
    });
    expect("error" in result).toBe(true);
  });

  it("rejects malformed dates", () => {
    expect("error" in parseGrievanceInput({ ...valid, dateReceived: "03/02/2026" })).toBe(
      true
    );
    expect(
      "error" in parseGrievanceInput({ ...valid, targetResolutionDate: "soon" })
    ).toBe(true);
  });

  it("treats non-object bodies as invalid", () => {
    expect("error" in parseGrievanceInput(null)).toBe(true);
    expect("error" in parseGrievanceInput("x")).toBe(true);
  });
});