// Builds a Google Maps link for a spot. If we know where the group is staying (the chosen
// accommodation's address), it's a directions link FROM there — so tapping "Maps ↗" shows the
// actual distance/route, not just a pin. Falls back to a plain search link otherwise.

export function spotMapsQuery(name: string, area: string): string {
  return `${name}, ${area}, Bali`;
}

export function buildMapsHref(destinationQuery: string, originAddress?: string | null): string {
  if (originAddress && originAddress.trim()) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddress.trim())}&destination=${encodeURIComponent(destinationQuery)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationQuery)}`;
}
