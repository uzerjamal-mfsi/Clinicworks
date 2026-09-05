export interface BpReading {
  systolic: number;
  diastolic: number;
  date: string | null;
  isGoal?: boolean;
  isHistorical?: boolean;
}

export interface Hba1cValue {
  value: number;
  date: string | null;
  isGoal?: boolean;
  isHistorical?: boolean;
  isReferenceRange?: boolean;
}

export function isValidDate(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function isValidBpReading(reading: BpReading): boolean {
  if (!Number.isFinite(reading.systolic) || !Number.isFinite(reading.diastolic)) return false;
  if (reading.systolic < 50 || reading.systolic > 300) return false;
  if (reading.diastolic < 30 || reading.diastolic > 200) return false;
  if (reading.isGoal) return false;
  if (reading.isHistorical) return false;
  return true;
}

function isValidHba1cValue(entry: Hba1cValue): boolean {
  if (!Number.isFinite(entry.value)) return false;
  if (entry.value < 3 || entry.value > 20) return false;
  if (entry.isGoal) return false;
  if (entry.isHistorical) return false;
  if (entry.isReferenceRange) return false;
  return true;
}

export function selectBpReading(
  readings: BpReading[],
  patientAgeYears: number | null
): BpReading | null {
  if (patientAgeYears !== null && patientAgeYears < 18) return null;
  const valid = readings.filter(isValidBpReading);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0] as BpReading;
  const dated = valid
    .filter((reading) => isValidDate(reading.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length > 0) return dated[dated.length - 1] as BpReading;
  const byLowest = [...valid].sort((a, b) => {
    const sumA = a.systolic + a.diastolic;
    const sumB = b.systolic + b.diastolic;
    if (sumA !== sumB) return sumA - sumB;
    return a.systolic - b.systolic;
  });
  return byLowest[0] as BpReading;
}

export function selectHba1cValue(values: Hba1cValue[]): Hba1cValue | null {
  const valid = values.filter(isValidHba1cValue);
  if (valid.length === 0) return null;
  const byLowest = [...valid].sort((a, b) => {
    if (a.value !== b.value) return a.value - b.value;
    const dateA = isValidDate(a.date) ? String(a.date) : "";
    const dateB = isValidDate(b.date) ? String(b.date) : "";
    return dateB.localeCompare(dateA);
  });
  return byLowest[0] as Hba1cValue;
}

export function classifyHba1c(value: number): string | null {
  if (value > 5.9) return "Diabetes";
  if (value > 5.7) return "Prediabetes";
  return null;
}

export function isBpUnderage(patientAgeYears: number | null): boolean {
  return patientAgeYears !== null && patientAgeYears < 18;
}

export function scoreConfidence(input: {
  hasDate: boolean;
  candidateCount: number;
  usedPdf: boolean;
}): number {
  let score = 0.9;
  if (!input.hasDate) score -= 0.15;
  if (input.candidateCount > 1) score -= 0.1;
  if (input.usedPdf) score -= 0.1;
  if (score > 0.95) score = 0.95;
  if (score < 0.3) score = 0.3;
  return Math.round(score * 100) / 100;
}
