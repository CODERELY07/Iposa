'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Business } from '@/lib/types/marketplace'
import { updateBusinessLocationAction } from '@/app/sell/settings/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import { AlertCircle, Loader2, MapPinned, X } from 'lucide-react'

// Powers the pickup address/map shown to a customer once they place a
// 'pickup' order (see the customer's orders page and the shop page) — never
// required, since a shop that only delivers has no use for it.
export default function BusinessLocationForm({ business }: { business: Business }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [form, setForm] = useState({
    address: business.address ?? '',
    lat: business.location_lat,
    lng: business.location_lng,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateBusinessLocationAction({
        address: form.address.trim() || null,
        location_lat: form.lat,
        location_lng: form.lng,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      toast.success('Pickup location saved.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pickup-address">Pickup address</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setMapOpen(true)}
          >
            <MapPinned className="size-3.5" /> Set on map
          </Button>
        </div>
        <Textarea
          id="pickup-address"
          rows={3}
          placeholder="Unit/floor, building, street, barangay…"
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
        {form.lat != null && form.lng != null ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinned className="size-3 text-primary" /> Pin saved — this is what customers see for pickup orders.
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, lat: null, lng: null }))}
              className="ml-0.5 inline-flex items-center rounded p-0.5 hover:bg-muted"
            >
              <X className="size-3" />
              <span className="sr-only">Clear pin</span>
            </button>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No pin set — customers picking up will only see the address text above, if any.
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Saving…' : 'Save location'}
      </Button>

      <MapLocationPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLat={form.lat}
        initialLng={form.lng}
        title="Set your pickup location"
        description="Search your shop's address, then drag the pin to line it up exactly — this is what customers will see for pickup orders."
        onConfirm={({ address, lat, lng }) => setForm(f => ({ ...f, address, lat, lng }))}
      />
    </form>
  )
}
