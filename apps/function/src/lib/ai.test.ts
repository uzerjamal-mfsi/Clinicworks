import { describe, it, expect } from "vitest";
import {
  buildExtractionPrompt,
  parseCandidatesResponse,
  resolveAiConfig,
  extractCandidates,
} from "./ai.js";

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
