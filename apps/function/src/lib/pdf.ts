// Polyfill for DOMMatrix used by pdfjs-dist in Node environment
if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {}
  // @ts-expect-error DOMMatrix is undefined in Node environment
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
import { PDFParse } from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

export function needsOcr(text: string): boolean {
  const digits = text.match(/\d/g) ?? [];
  if (digits.length < 3) return true;
  const hasBpPattern = /\d{2,3}\s*\/\s*\d{2,3}/.test(text);
  const hasA1cSignal = /a1c|hba1c|haemoglobin|hemoglobin|%/.test(text.toLowerCase());
  return !hasBpPattern && !hasA1cSignal;
}
