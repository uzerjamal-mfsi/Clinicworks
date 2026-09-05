import { z } from "zod";

export const bpCandidateSchema = z.object({
  systolic: z.coerce.number(),
  diastolic: z.coerce.number(),
  date: z.string().nullable().optional().default(null),
  isGoal: z.boolean().optional().default(false),
  isHistorical: z.boolean().optional().default(false),
});

export const hba1cCandidateSchema = z.object({
  value: z.coerce.number(),
  date: z.string().nullable().optional().default(null),
  isGoal: z.boolean().optional().default(false),
  isHistorical: z.boolean().optional().default(false),
  isReferenceRange: z.boolean().optional().default(false),
});

export const candidateSchema = z.object({
  documentType: z.enum(["BP", "HBA1C", "UNKNOWN"]).default("UNKNOWN"),
  bpReadings: z.array(bpCandidateSchema).default([]),
  hba1cValues: z.array(hba1cCandidateSchema).default([]),
  patientAgeYears: z.number().nullable().optional().default(null),
});

export type AiCandidates = z.infer<typeof candidateSchema>;

export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function resolveAiConfig(env: {
  AI_API_KEY?: string | undefined;
  AI_MODEL?: string | undefined;
  AI_API_URL?: string | undefined;
}): AiConfig {
  const apiKey = env.AI_API_KEY ?? "";
  if (!apiKey) throw new Error("AI_API_KEY is required");
  const model = env.AI_MODEL?.trim() ? String(env.AI_MODEL) : "gemini-3.1-flash-lite";
  const baseUrl = env.AI_API_URL?.trim()
    ? String(env.AI_API_URL).replace(/\/$/, "")
    : "https://generativelanguage.googleapis.com/v1beta";
  return { apiKey, model, baseUrl };
}

export type DocumentInput = { kind: "text"; text: string } | { kind: "pdf"; pdfBase64: string };

export function buildContentParts(input: DocumentInput): Array<Record<string, unknown>> {
  if (input.kind === "pdf") {
    return [
      { text: buildExtractionPrompt("The clinical document is attached as a PDF.") },
      { inlineData: { mimeType: "application/pdf", data: input.pdfBase64 } },
    ];
  }
  return [{ text: buildExtractionPrompt(input.text) }];
}

export function buildExtractionPrompt(documentText: string): string {
  return [
    "Extract clinical facts from the document text below.",
    "Return JSON only with keys: documentType, bpReadings, hba1cValues, patientAgeYears.",
    "documentType is BP, HBA1C, or UNKNOWN.",
    "bpReadings items need systolic, diastolic, date YYYY-MM-DD or null, isGoal, isHistorical.",
    "hba1cValues items need value, date YYYY-MM-DD or null, isGoal, isHistorical, isReferenceRange.",
    "Mark goals, targets, previous, historical, reference ranges with the matching flag.",
    "Include every reading found, do not decide the final result.",
    "Document text:",
    documentText.slice(0, 12000),
  ].join("\n");
}

const responseTextSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional().default("") })),
        }),
      })
    )
    .min(1),
});

export function parseCandidatesResponse(payload: unknown): AiCandidates {
  const parsed = responseTextSchema.parse(payload);
  const text = parsed.candidates[0]?.content.parts.map((part) => part.text).join("\n") ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain JSON");
  const jsonText = text.slice(start, end + 1);
  return candidateSchema.parse(JSON.parse(jsonText));
}

export async function extractCandidates(
  input: DocumentInput,
  config: AiConfig,
  fetchFn: typeof fetch = fetch
): Promise<AiCandidates> {
  const url = `${config.baseUrl}/models/${config.model}:generateContent`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ parts: buildContentParts(input) }],
    }),
  });
  if (!response.ok) throw new Error(`AI request failed with status ${response.status}`);
  return parseCandidatesResponse(await response.json());
}
