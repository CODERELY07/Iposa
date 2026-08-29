'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { haversineDistanceKm } from '@/lib/marketplace/distance'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Navigation, LocateFixed, AlertCircle } from 'lucide-react'

const PIN_ZOOM = 15

// Free rider-facing delivery map: the customer's pin (already collected at
// checkout) plus the rider's own live position (browser Geolocation,
// `watchPosition` so it keeps updating as they move), both on the same
// Leaflet/OpenStreetMap map already used elsewhere — no Google Maps API key,
// no billing, no routing backend. The dashed line + distance figure is
// straight-line (see lib/marketplace/distance.ts), not a road route — actual
// turn-by-turn is deliberately handed off to Google Maps/Waze below rather
// than reimplemented here, since a live-GPS-heading nav UI is a much bigger
// (and safety-relevant) undertaking than this app needs to own.
export default function DeliveryNavigationDialog({
  open,
  onOpenChange,
  customerLat,
  customerLng,
  customerLabel,
  address,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerLat: number
  customerLng: number
  customerLabel: string
  address?: string | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const customerMarkerRef = useRef<LeafletMarker | null>(null)
  const riderMarkerRef = useRef<LeafletMarker | null>(null)
  const lineRef = useRef<LeafletPolyline | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const boundsFittedRef = useRef(false)

  const [riderPosition, setRiderPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locateError, setLocateError] = useState<string | null>(null)

  // Mount the map only while the dialog is actually open — same "wait a
  // tick, then nudge Leaflet to re-measure" dance as MapLocationViewer/Picker,
  // since the dialog's container has no real size until Base UI finishes
  // rendering the popup.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    boundsFittedRef.current = false

    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      import('leaflet').then(L => {
        if (cancelled || !containerRef.current || mapRef.current) return

        delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const map = L.map(containerRef.current!).setView([customerLat, customerLng], PIN_ZOOM)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        customerMarkerRef.current = L.marker([customerLat, customerLng]).addTo(map).bindPopup(customerLabel)

        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 100)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Only (re)initialize when the dialog opens — the destination is fixed
    // for the life of one dialog instance (a new order gets a new mount via
    // React's own key/unmount, not a live-updating prop here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Tear the map down once the dialog closes so reopening builds a fresh one
  // instead of erroring on an already-initialized container.
  useEffect(() => {
    if (open) return
    mapRef.current?.remove()
    mapRef.current = null
    customerMarkerRef.current = null
    riderMarkerRef.current = null
    lineRef.current = null
  }, [open])

  // Live rider position: watchPosition (not a one-off getCurrentPosition)
  // since the whole point is a marker that keeps tracking as the rider
  // actually rides — cleared on close so it doesn't keep draining battery
  // or asking for a location fix in the background.
  useEffect(() => {
    if (!open) return
    if (!('geolocation' in navigator)) {
      setLocateError("This browser can't share your location — you can still open Navigate below.")
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setLocateError(null)
        setRiderPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      err => {
        setRiderPosition(null)
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied — enable it for this site to see your position on the map. Navigate below still works.'
            : "Couldn't get your location. Navigate below still works."
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [open])

  // Draws/updates the rider marker + dashed line as riderPosition changes,
  // and fits the map to show both pins the first time the rider's own
  // position becomes available (never re-fits on every subsequent update —
  // that would fight the rider zooming/panning to look around).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !riderPosition) return

    import('leaflet').then(L => {
      if (!mapRef.current) return
      const point: [number, number] = [riderPosition.lat, riderPosition.lng]

      if (!riderMarkerRef.current) {
        riderMarkerRef.current = L.marker(point, {
          icon: L.divIcon({
            className: '',
            html: '<span class="block size-3.5 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.35)]"></span>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        })
          .addTo(map)
          .bindPopup('You are here')
      } else {
        riderMarkerRef.current.setLatLng(point)
      }

      if (!lineRef.current) {
        lineRef.current = L.polyline([point, [customerLat, customerLng]], {
          color: '#0ea5e9',
          weight: 3,
          dashArray: '6 8',
          opacity: 0.8,
        }).addTo(map)
      } else {
        lineRef.current.setLatLngs([point, [customerLat, customerLng]])
      }

      if (!boundsFittedRef.current) {
        boundsFittedRef.current = true
        map.fitBounds(L.latLngBounds([point, [customerLat, customerLng]]), { padding: [40, 40], maxZoom: PIN_ZOOM })
      }
    })
    // customerLat/customerLng are fixed for the life of this dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderPosition])

  const distanceKm = riderPosition
    ? haversineDistanceKm(riderPosition.lat, riderPosition.lng, customerLat, customerLng)
    : null

  // No origin param: Google Maps fills it in as "My current location" via
  // its own device permission prompt, so this needs no coordinates of ours
  // at all — just the destination. Same idea for Waze.
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}&travelmode=driving`
  const wazeUrl = `https://waze.com/ul?ll=${customerLat}%2C${customerLng}&navigate=yes`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Navigate to {customerLabel}</DialogTitle>
          <DialogDescription>
            {address ?? 'Delivery location'}
            {distanceKm != null && ` — about ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away (straight line)`}
          </DialogDescription>
        </DialogHeader>

        {locateError && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 size-3 shrink-0" /> {locateError}
          </p>
        )}

        <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border" />

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <LocateFixed className="size-3 shrink-0" />
          The dashed line is a straight-line distance, not the actual road route — tap Navigate below for real
          turn-by-turn driving directions.
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" render={<a href={wazeUrl} target="_blank" rel="noopener noreferrer" />}>
              <Navigation className="size-4" /> Waze
            </Button>
            <Button className="gap-1.5" render={<a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" />}>
              <Navigation className="size-4" /> Google Maps
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
