import { describe, it, expect } from "vitest";
import {
  buildExtractionPrompt,
  parseCandidatesResponse,
  parseClinicalNumber,
  resolveAiConfig,
  extractCandidates,
} from "./ai.js";

function geminiPayload(innerJson: string) {
  return {
    candidates: [{ content: { parts: [{ text: innerJson }] } }],
  };
}

describe("AI adapter", () => {
  it("resolves defaults for model and base URL", () => {
    const config = resolveAiConfig({ AI_API_KEY: "test-key" });
    expect(config.model).toBe("gemini-3.1-flash-lite");
    expect(config.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta");
  });

  it("requires an API key", () => {
    expect(() => resolveAiConfig({})).toThrow();
  });

  it("builds a bounded prompt", () => {
    const prompt = buildExtractionPrompt("BP 128/84 on 2026-08-20");
    expect(prompt).toContain("bpReadings");
    expect(prompt).toContain("BP 128/84");
  });

  it("parses candidate JSON from model text", () => {
    const result = parseCandidatesResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                text: '{"documentType":"BP","bpReadings":[{"systolic":128,"diastolic":84,"date":"2026-08-20"}],"hba1cValues":[],"patientAgeYears":45}',
              },
            ],
          },
        },
      ],
    });
    expect(result.documentType).toBe("BP");
    expect(result.bpReadings[0]?.systolic).toBe(128);
  });

  it("parses unit-suffixed numbers and drops ranges instead of failing", () => {
    expect(parseClinicalNumber(6.2)).toBe(6.2);
    expect(parseClinicalNumber("6.2%")).toBe(6.2);
    expect(parseClinicalNumber(" 128 ")).toBe(128);
    expect(parseClinicalNumber("6,2")).toBe(6.2);
    expect(parseClinicalNumber("108 mg/dL")).toBe(108);
    expect(parseClinicalNumber("120mmHg")).toBe(120);
    expect(parseClinicalNumber("4.0–5.6%")).toBeNull();
    expect(parseClinicalNumber("128/84")).toBeNull();
    expect(parseClinicalNumber("no value")).toBeNull();
    expect(parseClinicalNumber(Number.NaN)).toBeNull();
    expect(parseClinicalNumber(null)).toBeNull();
  });

  it("keeps the measured HbA1c and drops the reference range", () => {
    const result = parseCandidatesResponse(
      geminiPayload(
        JSON.stringify({
          documentType: "HBA1C",
          bpReadings: [],
          hba1cValues: [
            {
              value: "6.2%",
              date: "2026-09-04",
              isGoal: false,
              isHistorical: false,
              isReferenceRange: false,
            },
            {
              value: "4.0–5.6%",
              date: null,
              isGoal: false,
              isHistorical: false,
              isReferenceRange: true,
            },
          ],
          patientAgeYears: null,
        })
      )
    );
    expect(result.documentType).toBe("HBA1C");
    expect(result.hba1cValues).toHaveLength(1);
    expect(result.hba1cValues[0]?.value).toBe(6.2);
    expect(result.hba1cValues[0]?.date).toBe("2026-09-04");
  });

  it("drops BP entries with unparseable numbers", () => {
    const result = parseCandidatesResponse(
      geminiPayload(
        JSON.stringify({
          documentType: "BP",
          bpReadings: [
            { systolic: "128/84", diastolic: 84, date: "2026-09-04" },
            { systolic: 118, diastolic: "76 mmHg", date: "2026-09-04" },
          ],
          hba1cValues: [],
          patientAgeYears: "45 years",
        })
      )
    );
    expect(result.bpReadings).toHaveLength(1);
    expect(result.bpReadings[0]?.systolic).toBe(118);
    expect(result.bpReadings[0]?.diastolic).toBe(76);
    expect(result.patientAgeYears).toBeNull();
  });

  it("sends provider-neutral HTTP request", async () => {
    let seenUrl = "";
    let seenKey = "";
    const fetchFn = async (url: string, init: { headers: Record<string, string> }) => {
      seenUrl = url;
      seenKey = init.headers["X-goog-api-key"] ?? "";
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"documentType":"UNKNOWN","bpReadings":[],"hba1cValues":[]}' }],
              },
            },
          ],
        }),
      } as unknown as Response;
    };
    const result = await extractCandidates(
      { kind: "text", text: "some text" },
      { apiKey: "k", model: "gemini-3.1-flash-lite", baseUrl: "https://example.test/v1beta" },
      fetchFn as unknown as typeof fetch
    );
    expect(seenUrl).toBe(
      "https://example.test/v1beta/models/gemini-3.1-flash-lite:generateContent"
    );
    expect(seenKey).toBe("k");
    expect(result.documentType).toBe("UNKNOWN");
  });

  it("sends the original PDF bytes for scanned documents", async () => {
    let seenBody = "";
    const fetchFn = async (_url: string, init: { body: string }) => {
      seenBody = init.body;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"documentType":"BP","bpReadings":[],"hba1cValues":[]}' }],
              },
            },
          ],
        }),
      } as unknown as Response;
    };
    await extractCandidates(
      { kind: "pdf", pdfBase64: "cGRmLWJ5dGVz" },
      { apiKey: "k", model: "gemini-3.1-flash-lite", baseUrl: "https://example.test/v1beta" },
      fetchFn as unknown as typeof fetch
    );
    const body = JSON.parse(seenBody) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    const parts = body.contents[0]?.parts ?? [];
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({
      inlineData: { mimeType: "application/pdf", data: "cGRmLWJ5dGVz" },
    });
  });
});
