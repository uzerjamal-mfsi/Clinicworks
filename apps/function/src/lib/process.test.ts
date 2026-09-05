import { describe, it, expect } from "vitest";
import { decideOutcome } from "./process.js";

describe("processing outcomes", () => {
  it("succeeds for BP text fixture", () => {
    const outcome = decideOutcome(
      {
        documentType: "BP",
        bpReadings: [
          { systolic: 128, diastolic: 84, date: "2026-08-20", isGoal: false, isHistorical: false },
        ],
        hba1cValues: [],
        patientAgeYears: 45,
      },
      false
    );
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.documentType).toBe("BP");
    expect(outcome.measureValue).toBe("128/84");
    expect(outcome.measureDate).toBe("2026-08-20");
  });

  it("succeeds for scanned BP fixture using OCR text", () => {
    const outcome = decideOutcome(
      {
        documentType: "BP",
        bpReadings: [
          { systolic: 132, diastolic: 86, date: "2026-08-21", isGoal: false, isHistorical: false },
        ],
        hba1cValues: [],
        patientAgeYears: 52,
      },
      true
    );
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.measureValue).toBe("132/86");
    expect(outcome.confidenceScore).toBeLessThan(0.9);
  });

  it("succeeds for HbA1c text fixture with classification", () => {
    const outcome = decideOutcome(
      {
        documentType: "HBA1C",
        bpReadings: [],
        hba1cValues: [
          {
            value: 6.4,
            date: "2026-08-20",
            isGoal: false,
            isHistorical: false,
            isReferenceRange: false,
          },
        ],
        patientAgeYears: null,
      },
      false
    );
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.documentType).toBe("HBA1C");
    expect(outcome.classification).toBe("Diabetes");
  });

  it("succeeds for scanned HbA1c fixture", () => {
    const outcome = decideOutcome(
      {
        documentType: "HBA1C",
        bpReadings: [],
        hba1cValues: [
          {
            value: 5.8,
            date: "2026-08-22",
            isGoal: false,
            isHistorical: false,
            isReferenceRange: false,
          },
        ],
        patientAgeYears: null,
      },
      true
    );
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.classification).toBe("Prediabetes");
  });

  it("needs review when no reliable value exists", () => {
    const outcome = decideOutcome(
      { documentType: "BP", bpReadings: [], hba1cValues: [], patientAgeYears: 40 },
      false
    );
    expect(outcome.status).toBe("NEEDS_REVIEW");
  });

  it("needs review for underage BP", () => {
    const outcome = decideOutcome(
      {
        documentType: "BP",
        bpReadings: [
          { systolic: 110, diastolic: 70, date: "2026-08-20", isGoal: false, isHistorical: false },
        ],
        hba1cValues: [],
        patientAgeYears: 12,
      },
      false
    );
    expect(outcome.status).toBe("NEEDS_REVIEW");
    expect(outcome.measureValue).toBeNull();
  });
});
