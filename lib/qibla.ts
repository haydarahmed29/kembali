const KAABA = { lat: 21.4225, lon: 39.8262 };

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

/** Bearing (0-360, clockwise from true north) from a point to the Kaaba. */
export function qiblaBearing(lat: number, lon: number): number {
  const lat1 = toRad(lat);
  const lat2 = toRad(KAABA.lat);
  const dLon = toRad(KAABA.lon - lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}
