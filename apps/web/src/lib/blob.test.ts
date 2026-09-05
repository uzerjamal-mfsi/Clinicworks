import { describe, expect, it } from "vitest";
import { blobNameForDocument, sanitizeFileName } from "./blob";

describe("blob naming", () => {
  it("prefixes blob with document id", () => {
    expect(blobNameForDocument(42, "report.pdf")).toBe("42/report.pdf");
  });

  it("strips paths and unsafe chars", () => {
    expect(blobNameForDocument(7, "../../weird name!!.pdf")).toBe("7/weird-name-.pdf");
  });

  it("falls back for empty names", () => {
    expect(sanitizeFileName("")).toBe("document.pdf");
  });
});
