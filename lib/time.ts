/** "9.5", "9:5", "9" → "09:05" / "09:00", so string sorting matches clock order. Returns null if unparseable. */
export function normalizeTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.trim().match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Ask for day + time with prompts; returns null if the user cancels or types nonsense. */
export function promptDayAndTime(defaultTime = "10:00"): { day: number; time: string } | null {
  const dayRaw = window.prompt("Hari ke-berapa?", "1");
  if (dayRaw === null) return null;
  const day = Math.max(1, Math.min(30, Math.round(Number(dayRaw)) || 1));
  const timeRaw = window.prompt("Jam berapa? (misal 09:30)", defaultTime);
  if (timeRaw === null) return null;
  const time = normalizeTime(timeRaw);
  if (!time) {
    window.alert("Format jam-nya kurang pas. Contoh: 09:30");
    return null;
  }
  return { day, time };
}

/** Parse "50.000", "Rp 1.250.000", "50000" → number (Indonesian thousands dots). */
export function parseRupiah(input: string | null | undefined): number {
  if (!input) return 0;
  return Number(input.replace(/[^\d]/g, "")) || 0;
}
