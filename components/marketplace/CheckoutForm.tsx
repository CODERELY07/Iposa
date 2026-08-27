'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCart } from '@/lib/marketplace/cart-context'
import { placeOrderAction } from '@/app/(marketplace)/checkout/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function CheckoutForm({ defaultName }: { defaultName: string }) {
  const { items, totalPrice, clear } = useCart()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: defaultName, phone: '', address: '', notes: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await placeOrderAction(items, form)
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

      <div className="space-y-1.5">
        <Label htmlFor="address">Delivery address</Label>
        <Textarea
          id="address"
          required
          rows={3}
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
      </div>

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
        <Button type="submit" size="lg" disabled={isPending || items.length === 0}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? 'Placing order…' : 'Place order'}
        </Button>
      </div>
    </form>
  )
}
