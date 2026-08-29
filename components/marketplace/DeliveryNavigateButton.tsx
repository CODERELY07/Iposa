'use client'

import { useState } from 'react'
import DeliveryNavigationDialog from '@/components/marketplace/DeliveryNavigationDialog'
import { Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'

// Thin trigger for DeliveryNavigationDialog — the business/rider-facing
// counterpart to ViewOnMapButton's plain pin view: this one also plots the
// rider's own live position alongside the customer's, all on the same
// in-app Leaflet map (no hand-off to an external maps app). Used on the
// Online Orders page for a delivery order's pin.
export default function DeliveryNavigateButton({
  lat,
  lng,
  label = 'Navigate',
  customerLabel,
  address,
  className,
}: {
  lat: number
  lng: number
  label?: string
  customerLabel: string
  address?: string | null
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
        <Navigation className="size-3" /> {label}
      </button>
      <DeliveryNavigationDialog
        open={open}
        onOpenChange={setOpen}
        customerLat={lat}
        customerLng={lng}
        customerLabel={customerLabel}
        address={address}
      />
    </>
  )
}
