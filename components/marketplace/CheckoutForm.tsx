'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCart } from '@/lib/marketplace/cart-context'
import { createClient } from '@/lib/supabase/client'
import { placeOrderAction } from '@/app/(marketplace)/checkout/actions'
import type { FulfillmentMethod } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import ViewOnMapButton from '@/components/marketplace/ViewOnMapButton'
import { AlertCircle, Loader2, MapPinned, Store, Truck, X } from 'lucide-react'

type PickupLocation = {
  businessId: string
  businessName: string
  address: string | null
  lat: number | null
  lng: number | null
}

export default function CheckoutForm({ defaultName }: { defaultName: string }) {
  const { items, totalPrice, clear, groupedByBusiness } = useCart()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [form, setForm] = useState({
    name: defaultName,
    phone: '',
    address: '',
    notes: '',
    fulfillmentMethod: 'delivery' as FulfillmentMethod,
    lat: null as number | null,
    lng: null as number | null,
  })

  const isDelivery = form.fulfillmentMethod === 'delivery'
  const needsPin = isDelivery && (form.lat == null || form.lng == null)

  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
  const [pickupLoading, setPickupLoading] = useState(false)
  const businessIdsKey = groupedByBusiness.map(g => g.businessId).join(',')

  // Pulled fresh from `businesses` rather than carried on the cart item —
  // the cart only ever stored what a product listing needs (id/name/price),
  // never the seller's pickup pin, so picking "Pickup" here has to fetch it.
  useEffect(() => {
    if (isDelivery || !businessIdsKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickupLocations([])
      return
    }
    let cancelled = false
    async function load() {
      setPickupLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('businesses')
        .select('id, name, address, location_lat, location_lng')
        .in('id', businessIdsKey.split(','))
      if (cancelled) return
      setPickupLocations(
        groupedByBusiness.map(g => {
          const biz = data?.find(b => b.id === g.businessId)
          return {
            businessId: g.businessId,
            businessName: g.businessName,
            address: biz?.address ?? null,
            lat: biz?.location_lat ?? null,
            lng: biz?.location_lng ?? null,
          }
        })
      )
      setPickupLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // groupedByBusiness is intentionally not a dep — it's a new array each
    // render but stable in content whenever businessIdsKey doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDelivery, businessIdsKey])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (needsPin) {
      setError('Confirm your exact delivery location on the map before placing your order.')
      return
    }

    startTransition(async () => {
      const result = await placeOrderAction(items, {
        name: form.name,
        phone: form.phone,
        address: isDelivery ? form.address : '',
        notes: form.notes,
        fulfillmentMethod: form.fulfillmentMethod,
        lat: isDelivery ? form.lat : null,
        lng: isDelivery ? form.lng : null,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      clear()
      toast.success('Order placed! Track it from My Orders.')
      router.push('/orders')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label>How do you want this?</Label>
        <Tabs
          value={form.fulfillmentMethod}
          onValueChange={value =>
            setForm(f => ({ ...f, fulfillmentMethod: value as FulfillmentMethod }))
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="delivery">
              <Truck /> Delivery
            </TabsTrigger>
            <TabsTrigger value="pickup">
              <Store /> Pickup
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          required
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        />
      </div>

      {isDelivery ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="address">Delivery address</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setMapOpen(true)}
            >
              <MapPinned className="size-3.5" /> Confirm on map
            </Button>
          </div>
          <Textarea
            id="address"
            required
            rows={3}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          {form.lat != null && form.lng != null ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinned className="size-3 text-primary" /> Location pinned on map
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
              Required — tap &quot;Confirm on map&quot; above to pin your exact location so delivery is accurate.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Alert>
            <Store />
            <AlertDescription>
              You&apos;ll pick this up directly from the seller. They&apos;ll reach out with the pickup address and timing.
            </AlertDescription>
          </Alert>

          {pickupLoading && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading pickup location…
            </p>
          )}

          {!pickupLoading && pickupLocations.map(loc => (
            <div key={loc.businessId} className="rounded-lg border p-3 text-xs">
              <p className="font-medium text-foreground">{loc.businessName}</p>
              {loc.address && <p className="mt-0.5 text-muted-foreground">{loc.address}</p>}
              {loc.lat != null && loc.lng != null ? (
                <ViewOnMapButton
                  className="mt-1.5"
                  lat={loc.lat}
                  lng={loc.lng}
                  title={`Pick up from ${loc.businessName}`}
                  description={loc.address ?? undefined}
                  label="View shop location on map"
                />
              ) : (
                <p className="mt-1.5 text-muted-foreground">
                  No pickup location set yet — the seller will contact you with pickup details.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={2}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-brand-soft p-4">
        <span className="text-sm text-muted-foreground">
          Total: <span className="font-mono text-lg font-bold text-foreground">₱{totalPrice.toFixed(2)}</span>
        </span>
        <Button type="submit" size="lg" disabled={isPending || items.length === 0 || needsPin}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? 'Placing order…' : 'Place order'}
        </Button>
      </div>

      <MapLocationPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLat={form.lat}
        initialLng={form.lng}
        onConfirm={({ address, lat, lng }) => setForm(f => ({ ...f, address, lat, lng }))}
      />
    </form>
  )
}
