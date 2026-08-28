// Free geocoding via OpenStreetMap's Nominatim — the "confirm on map" step
// on checkout resolves an address (or a dropped pin) through this instead of
// the Google Maps Geocoding API, so drivers get a lat/lng pin with no API
// key or billing involved. See MapLocationPicker for where this is used.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// caps unauthenticated use at ~1 request/second and asks callers to identify
// themselves — the browser's own Referer header covers that here, since a
// client-side fetch can't set a custom User-Agent. Callers are expected to
// debounce user input themselves (MapLocationPicker does, on its search box).

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export type GeocodeResult = {
  displayName: string
  lat: number
  lng: number
}

// Biased toward the Philippines (this marketplace's own market — see the ₱
// symbol used throughout) but not restricted to it, in case a search still
// needs to resolve somewhere else.
export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url = new URL(`${NOMINATIM_BASE}/search`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('countrycodes', 'ph')
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error('Address search failed')

  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return data.map(r => ({ displayName: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
}

// Turns a dropped/dragged pin back into a readable address to prefill the
// delivery address field with. Returns null rather than throwing on failure
// (or "no result") — the customer's own typed address is always the fallback.
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const url = new URL(`${NOMINATIM_BASE}/reverse`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    return data.display_name ?? null
  } catch {
    return null
  }
}
