'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchAddress, reverseGeocode, type GeocodeResult } from '@/lib/marketplace/geocode'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, MapPin, Search } from 'lucide-react'

// Free "confirm on map" step, built on Leaflet + OpenStreetMap tiles and
// Nominatim search/reverse-geocoding — the cheaper middle ground the address
// textarea alone can't give: an actual lat/lng pin, with no Google Maps API
// key or billing involved. See lib/marketplace/geocode.ts for the API calls.

// Defaults to Metro Manila when the customer hasn't picked anything yet —
// this marketplace's own market (see the ₱ symbol used throughout) — rather
// than a zoomed-out world view with no marker to drag.
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842]
const DEFAULT_ZOOM = 12
const PIN_ZOOM = 16

export type MapLocationResult = { address: string; lat: number; lng: number }

export default function MapLocationPicker({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  onConfirm,
  title = 'Confirm delivery location',
  description = 'Search your address, then drag the pin (or tap the map) to line it up exactly.',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (result: MapLocationResult) => void
  /** Defaults are worded for a checkout delivery pin — pass these when
   *  reusing the picker elsewhere (e.g. a business's own pickup location in
   *  Shop Settings) so the copy actually matches what's being set. */
  title?: string
  description?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  // Set right before setQuery() when a search result is picked, so filling
  // the box with its own display name doesn't immediately re-trigger a
  // search of that exact text.
  const skipNextSearchRef = useRef(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  )
  const [confirming, setConfirming] = useState(false)

  // A query shorter than Nominatim's own minimum just means "nothing to
  // show yet" — computed at render time instead of synced into state, so
  // shortening the query can't leave a stale results list on screen.
  const queryReady = query.trim().length >= 3

  // Debounced Nominatim search — respects its ~1req/s usage policy instead
  // of firing on every keystroke.
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    if (!queryReady) return
    const controller = new AbortController()
    // Flips the debounced search into its loading state; the actual result
    // state is only ever set from the async .then()/.catch() below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearching(true)
    const timer = setTimeout(() => {
      searchAddress(query, controller.signal)
        .then(r => {
          setResults(r)
          setSearchError(r.length === 0 ? 'No matches found.' : null)
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setSearchError('Address search failed — try again.')
        })
        .finally(() => setSearching(false))
    }, 500)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, queryReady])

  // Mount the map only while the dialog is actually open — the container
  // has no real size until Base UI finishes rendering the popup, so this
  // waits a tick and then nudges Leaflet to re-measure it.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      import('leaflet').then(L => {
        if (cancelled || !containerRef.current || mapRef.current) return

        // Leaflet's default marker icon resolves relative to the bundler's
        // asset path, which breaks under Next.js. Pointing it at the same
        // versioned CDN copy of the package's own icons sidesteps that
        // without adding an icon-bundling step for three small PNGs.
        delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const center: [number, number] = position ? [position.lat, position.lng] : DEFAULT_CENTER
        const map = L.map(containerRef.current!).setView(center, position ? PIN_ZOOM : DEFAULT_ZOOM)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        const marker = L.marker(center, { draggable: true }).addTo(map)
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          setPosition({ lat, lng })
        })
        map.on('click', e => {
          marker.setLatLng(e.latlng)
          setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
        })

        mapRef.current = map
        markerRef.current = marker
        setTimeout(() => map.invalidateSize(), 100)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Only (re)initialize when the dialog opens — `position` is intentionally
    // read once here for the initial view, not tracked afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Tear the map down once the dialog closes so reopening builds a fresh
  // one instead of erroring on an already-initialized container.
  useEffect(() => {
    if (open) return
    mapRef.current?.remove()
    mapRef.current = null
    markerRef.current = null
  }, [open])

  function flyTo(lat: number, lng: number) {
    setPosition({ lat, lng })
    markerRef.current?.setLatLng([lat, lng])
    mapRef.current?.setView([lat, lng], PIN_ZOOM)
  }

  function handleConfirm() {
    if (!position) return
    setConfirming(true)
    reverseGeocode(position.lat, position.lng)
      .then(address => {
        onConfirm({ address: address ?? query.trim(), lat: position.lat, lng: position.lng })
        onOpenChange(false)
      })
      .finally(() => setConfirming(false))
  }

  return (
    <Dialog open={open} onOpenChange={o => !confirming && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search for a street, barangay, or landmark…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {queryReady && searching && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Searching…
          </p>
        )}
        {queryReady && !searching && searchError && <p className="text-xs text-muted-foreground">{searchError}</p>}

        {queryReady && !searching && results.length > 0 && (
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border p-1">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  flyTo(r.lat, r.lng)
                  setResults([])
                  skipNextSearchRef.current = true
                  setQuery(r.displayName)
                }}
                className="flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
              >
                <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                {r.displayName}
              </button>
            ))}
          </div>
        )}

        <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border" />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" disabled={!position || confirming} onClick={handleConfirm}>
            {confirming && <Loader2 className="animate-spin" />} Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
