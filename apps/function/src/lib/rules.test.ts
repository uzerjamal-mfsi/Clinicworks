import { describe, it, expect } from "vitest";
import { selectBpReading, selectHba1cValue, classifyHba1c, scoreConfidence } from "./rules.js";

describe("BP rules", () => {
  it("returns null when patient is under 18", () => {
    const result = selectBpReading([{ systolic: 110, diastolic: 70, date: "2026-08-20" }], 17);
    expect(result).toBeNull();
  });

  it("picks most recent dated reading", () => {
    const result = selectBpReading(
      [
        { systolic: 140, diastolic: 90, date: "2026-08-18" },
        { systolic: 128, diastolic: 84, date: "2026-08-20" },
      ],
      45
    );
    expect(result).toEqual({ systolic: 128, diastolic: 84, date: "2026-08-20" });
  });

  it("falls back to lowest systolic plus diastolic when recency unknown", () => {
    const result = selectBpReading(
      [
        { systolic: 140, diastolic: 90, date: null },
        { systolic: 118, diastolic: 76, date: null },
      ],
      null
    );
    expect(result?.systolic).toBe(118);
    expect(result?.diastolic).toBe(76);
  });

  it("rejects goal target and historical readings", () => {
    const result = selectBpReading(
      [
        { systolic: 110, diastolic: 70, date: "2026-08-20", isGoal: true },
        { systolic: 112, diastolic: 72, date: "2026-08-19", isHistorical: true },
        { systolic: 130, diastolic: 85, date: "2026-08-20" },
      ],
      40
    );
    expect(result?.systolic).toBe(130);
  });

  it("returns null for incomplete BP", () => {
    const result = selectBpReading(
      [
        { systolic: Number.NaN, diastolic: 80, date: "2026-08-20" },
        { systolic: 3000, diastolic: 80, date: "2026-08-20" },
      ],
      40
    );
    expect(result).toBeNull();
  });
});

describe("HbA1c rules", () => {
  it("picks lowest valid value", () => {
    const result = selectHba1cValue([
      { value: 6.4, date: "2026-08-20" },
      { value: 5.9, date: "2026-08-21" },
    ]);
    expect(result?.value).toBe(5.9);
  });

  it("classifies 5.8 as prediabetes and 6.5 as diabetes", () => {
    expect(classifyHba1c(5.8)).toBe("Prediabetes");
    expect(classifyHba1c(6.5)).toBe("Diabetes");
    expect(classifyHba1c(5.7)).toBeNull();
    expect(classifyHba1c(5.5)).toBeNull();
  });

  it("rejects goals historical and reference ranges", () => {
    const result = selectHba1cValue([
      { value: 5.4, date: "2026-08-20", isGoal: true },
      { value: 5.5, date: "2026-08-20", isHistorical: true },
      { value: 6.0, date: "2026-08-20", isReferenceRange: true },
      { value: 6.2, date: "2026-08-20" },
    ]);
    expect(result?.value).toBe(6.2);
  });
});

describe("confidence", () => {
  it("lowers score without date multiple candidates or OCR", () => {
    const full = scoreConfidence({ hasDate: true, candidateCount: 1, usedPdf: false });
    const weak = scoreConfidence({ hasDate: false, candidateCount: 3, usedPdf: true });
    expect(full).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThanOrEqual(0.3);
    expect(full).toBeLessThanOrEqual(0.95);
  });
});
