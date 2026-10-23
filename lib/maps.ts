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

// Instagram/Pinterest have no public "search by location" API without app review, so these open
// each platform's own keyword search instead — lands on matching hashtags/locations/pins for the
// spot name, which is the closest no-API equivalent.
export function buildInstagramHref(name: string, area: string): string {
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${name} ${area} Bali`)}`;
}

export function buildPinterestHref(name: string, area: string): string {
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${name} ${area} Bali`)}`;
}
