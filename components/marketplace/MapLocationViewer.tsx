'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

// Read-only counterpart to MapLocationPicker — same Leaflet/OpenStreetMap
// tiles, but just a fixed pin to look at (no search, no dragging). Used
// wherever an already-set location needs to actually be shown as a map
// rather than a bare "View on map" link out to another site: the pickup
// pin in Checkout, and a customer's own order list.
const PIN_ZOOM = 16

export default function MapLocationViewer({
  open,
  onOpenChange,
  lat,
  lng,
  title,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lat: number
  lng: number
  title: string
  description?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  // Same "mount only while actually open, then nudge Leaflet to re-measure"
  // dance as MapLocationPicker — the dialog's container has no real size
  // until Base UI finishes rendering the popup.
  useEffect(() => {
    if (!open) return
    let cancelled = false

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

        const map = L.map(containerRef.current!).setView([lat, lng], PIN_ZOOM)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        L.marker([lat, lng]).addTo(map)

        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 100)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, lat, lng])

  // Tear the map down once the dialog closes, same reason as
  // MapLocationPicker — reopening builds a fresh one instead of erroring on
  // an already-initialized container.
  useEffect(() => {
    if (open) return
    mapRef.current?.remove()
    mapRef.current = null
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border" />

        <DialogFooter className="sm:justify-between">
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" /> Get directions on OpenStreetMap
          </a>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
