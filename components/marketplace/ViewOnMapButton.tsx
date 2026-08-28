'use client'

import { useState } from 'react'
import MapLocationViewer from '@/components/marketplace/MapLocationViewer'
import { MapPinned } from 'lucide-react'
import { cn } from '@/lib/utils'

// Thin trigger for MapLocationViewer — click a plain inline link/button,
// see the actual pin, instead of getting shipped straight out to another
// site. Used both on the pickup section of Checkout and on a customer's own
// order list.
export default function ViewOnMapButton({
  lat,
  lng,
  title,
  description,
  label = 'View on map',
  className,
}: {
  lat: number
  lng: number
  title: string
  description?: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('inline-flex items-center gap-1 text-primary hover:underline', className)}
      >
        <MapPinned className="size-3" /> {label}
      </button>
      <MapLocationViewer open={open} onOpenChange={setOpen} lat={lat} lng={lng} title={title} description={description} />
    </>
  )
}
