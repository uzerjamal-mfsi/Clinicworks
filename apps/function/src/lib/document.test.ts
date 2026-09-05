import { describe, it, expect } from "vitest";
import { needsOcr } from "./pdf.js";

describe("pdf text detection", () => {
  it("requests PDF input only when no usable clinical signal was extracted", () => {
    expect(needsOcr("")).toBe(true);
    expect(needsOcr("scanned image with no numbers at all")).toBe(true);
    expect(needsOcr("Please see attached clinical notes over the next few days")).toBe(true);
    expect(needsOcr("Blood pressure 128/84 measured on 2026-08-20.")).toBe(false);
    expect(needsOcr("HbA1c 6.4% dated 2026-08-20.")).toBe(false);
  });
});
