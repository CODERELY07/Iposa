// Straight-line ("as the crow flies") distance between two coordinates, in
// kilometers — used only as a rough at-a-glance figure next to the delivery
// map (see DeliveryNavigationDialog). This is NOT a road distance: getting a
// real driving distance/route means calling a routing engine (OSRM,
// OpenRouteService, etc.), which this app deliberately doesn't do — actual
// turn-by-turn navigation is handed off to Google Maps/Waze instead, which
// already do that well. The haversine formula below needs no API call and no
// key, just the two lat/lng pairs already on screen.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's mean radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
