import type { Gender } from "./types";

export const DEFAULT_SUPPLIES = [
  "Powerbank",
  "Charger HP",
  "Kabel USB-C",
  "Earphone/TWS",
  "Adapter colokan",
  "Obat pribadi",
  "Vitamin",
  "Obat anti mabuk",
  "Obat diare",
  "Plester",
  "Minyak angin / kayu putih",
  "Hand sanitizer",
  "Masker",
  "Sunscreen SPF 50",
  "After sun lotion",
  "Tissue kering",
  "Tissue basah",
  "Kantong plastik",
  "Lotion anti nyamuk",
  "Kacamata hitam",
  "Dry bag",
  "Sikat & odol travel size",
];

const BASE_OUTFIT = ["Atasan", "Celana panjang", "Jaket", "Kaos kaki", "Baju tidur", "Sepatu jalan", "Sendal", "Celana dalam", "Topi", "Kacamata"];

export function defaultOutfitCategories(gender: Gender): string[] {
  if (gender === "female") {
    // insert "Bra" after "Celana dalam" to roughly match the mockup's order
    const idx = BASE_OUTFIT.indexOf("Celana dalam");
    return [...BASE_OUTFIT.slice(0, idx + 1), "Bra", ...BASE_OUTFIT.slice(idx + 1)];
  }
  return BASE_OUTFIT;
}

export const DEFAULT_BAGS = ["Koper besar", "Tas ransel", "Tas tenteng"];
