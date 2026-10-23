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

/** Ask for day + time in one sheet; returns null if the user cancels. Bad time format just falls back to defaultTime. */
export async function promptDayAndTime(defaultTime = "10:00"): Promise<{ day: number; time: string } | null> {
  const { promptFields } = await import("./promptSheet");
  const result = await promptFields(
    [
      { key: "day", label: "Hari ke-", defaultValue: "1", type: "number" },
      { key: "time", label: "Jam", defaultValue: defaultTime, placeholder: "misal 09:30" },
    ],
    { title: "Masukin ke itinerary hari & jam berapa?", confirmLabel: "Lanjut" }
  );
  if (!result) return null;
  const day = Math.max(1, Math.min(30, Math.round(Number(result.day)) || 1));
  const time = normalizeTime(result.time) ?? defaultTime;
  return { day, time };
}

/** Parse "50.000", "Rp 1.250.000", "50000" → number (Indonesian thousands dots). */
export function parseRupiah(input: string | null | undefined): number {
  if (!input) return 0;
  return Number(input.replace(/[^\d]/g, "")) || 0;
}
