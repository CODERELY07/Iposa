'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCart } from '@/lib/marketplace/cart-context'
import { placeOrderAction } from '@/app/(marketplace)/checkout/actions'
import type { FulfillmentMethod } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import { AlertCircle, Loader2, MapPinned, Store, Truck, X } from 'lucide-react'

export default function CheckoutForm({ defaultName }: { defaultName: string }) {
  const { items, totalPrice, clear } = useCart()
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
        <Alert>
          <Store />
          <AlertDescription>
            You&apos;ll pick this up directly from the seller. They&apos;ll reach out with the pickup address and timing.
          </AlertDescription>
        </Alert>
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
