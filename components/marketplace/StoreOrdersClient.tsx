'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { FulfillmentMethod, OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { OrderStatusBadge, FulfillmentBadge } from '@/components/marketplace/StatusBadge'
import { AlertCircle, PackageX, Clock3, ShieldAlert, CheckCircle2, MapPinned, Ban, Loader2 } from 'lucide-react'

type OrderRow = {
  id: string
  status: OrderStatus
  total: number
  shipping_name: string | null
  shipping_phone: string | null
  fulfillment_method: FulfillmentMethod
  shipping_address: string | null
  shipping_lat: number | null
  shipping_lng: number | null
  notes: string | null
  awaiting_confirmation_at: string | null
  dispute_reason: string | null
  cancellation_reason: string | null
  created_at: string
  store_order_items: StoreOrderItem[]
}

// Statuses where the business still has a say — once an order moves past
// this (into 'awaiting_confirmation' and beyond), neither the dropdown nor
// the cancel button below shows: only the customer/admin actions on the
// other side can move it further. See store_orders_update_business_owner
// and trg_enforce_order_status_rules in database_schema.sql, which enforce
// the same restriction at the database level regardless of what this UI
// happens to expose.
const EDITABLE_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped']

// What the dropdown itself offers. 'awaiting_confirmation' ("out for
// delivery") used to be a separate "Mark as done" button/RPC — it's just
// another status now, and setting it is a one-way door (see above): the
// business can't undo it, cancel it, or otherwise reopen it once picked.
const STATUS_OPTIONS: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'awaiting_confirmation']
const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  awaiting_confirmation: 'out for delivery',
}

// Mirrors order_confirmation_window() in database_schema.sql — display-only,
// the real deadline is enforced server-side by auto_confirm_stale_orders().
const CONFIRMATION_WINDOW_DAYS = 4

export default function StoreOrdersClient({
  orders,
  onUpdateStatus,
  onCancel,
}: {
  orders: OrderRow[]
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>
  onCancel: (orderId: string, reason: string) => Promise<{ success: boolean; message?: string }>
}) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  function handleChange(orderId: string, status: OrderStatus) {
    setError(null)
    setBusyId(orderId)
    startTransition(async () => {
      try {
        await onUpdateStatus(orderId, status)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update order.')
      } finally {
        setBusyId(null)
      }
    })
  }

  function handleCancel() {
    if (!cancelTarget || !cancelReason.trim()) return
    const orderId = cancelTarget
    setBusyId(orderId)
    startTransition(async () => {
      const result = await onCancel(orderId, cancelReason.trim())
      if (!result.success) {
        toast.error(result.message ?? 'Failed to cancel order.')
      } else {
        toast.success('Order cancelled.')
        setCancelTarget(null)
        setCancelReason('')
      }
      setBusyId(null)
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{orders.length} orders total</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {orders.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <PackageX className="size-6 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      )}

      {orders.map(order => {
        const busy = isPending && busyId === order.id
        const editable = EDITABLE_STATUSES.includes(order.status)
        const deadline = order.awaiting_confirmation_at
          ? new Date(new Date(order.awaiting_confirmation_at).getTime() + CONFIRMATION_WINDOW_DAYS * 86400000)
          : null

        return (
        <Card key={order.id} className="overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-brand-soft px-4 py-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
              <p className="text-sm font-bold text-foreground">{order.shipping_name ?? 'Customer'}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <FulfillmentBadge method={order.fulfillment_method} />
              <OrderStatusBadge status={order.status} />
              {editable && (
                <Select
                  value={order.status}
                  disabled={busy}
                  onValueChange={value => handleChange(order.id, value as OrderStatus)}
                >
                  <SelectTrigger size="sm" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setCancelTarget(order.id)
                    setCancelReason('')
                  }}
                >
                  <Ban /> Cancel
                </Button>
              )}
            </div>
          </div>

          {order.status === 'awaiting_confirmation' && (
            <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              <Clock3 className="size-3.5 shrink-0 translate-y-0.5" />
              <span>
                Waiting for the customer to confirm they received this — you can&apos;t change its status further from
                here. It auto-confirms{deadline ? ` on ${deadline.toLocaleDateString()}` : ''} if they don&apos;t respond.
              </span>
            </div>
          )}

          {order.status === 'disputed' && (
            <div className="flex items-start gap-2 border-b bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              <ShieldAlert className="size-3.5 shrink-0 translate-y-0.5" />
              <div>
                <p className="font-semibold">Under review by MElocalmarketplace support.</p>
                {order.dispute_reason && <p className="mt-0.5">Customer said: &quot;{order.dispute_reason}&quot;</p>}
              </div>
            </div>
          )}

          {order.status === 'cancelled' && order.cancellation_reason && (
            <div className="flex items-start gap-2 border-b bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
              <Ban className="size-3.5 shrink-0 translate-y-0.5" />
              <span>You cancelled this: &quot;{order.cancellation_reason}&quot;</span>
            </div>
          )}

          {order.status === 'completed' && (
            <div className="flex items-center gap-2 border-b bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" /> Confirmed complete.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Items</p>
              <div className="space-y-1 text-sm">
                {order.store_order_items.map(item => (
                  <div key={item.id} className="flex justify-between text-foreground">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span className="font-mono">₱{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold text-foreground">
                <span>Total</span>
                <span className="font-mono">₱{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">
                {order.fulfillment_method === 'pickup' ? 'Pickup' : 'Delivery'}
              </p>
              <p className="text-sm text-foreground">{order.shipping_phone}</p>
              {order.fulfillment_method === 'pickup' ? (
                <p className="text-sm text-muted-foreground">Customer will pick this up in person.</p>
              ) : (
                <>
                  <p className="text-sm text-foreground">{order.shipping_address}</p>
                  {order.shipping_lat != null && order.shipping_lng != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${order.shipping_lat}&mlon=${order.shipping_lng}#map=17/${order.shipping_lat}/${order.shipping_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <MapPinned className="size-3" /> View pinned location
                    </a>
                  )}
                </>
              )}
              {order.notes && <p className="mt-1 text-xs italic text-muted-foreground">&quot;{order.notes}&quot;</p>}
            </div>
          </div>
        </Card>
        )
      })}

      <Dialog open={cancelTarget !== null} onOpenChange={open => !isPending && !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              The customer sees this reason on their own order — and can report it later if it turns out they received
              it anyway, so it&apos;s worth being accurate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              autoFocus
              placeholder="e.g., out of stock, couldn't reach the customer…"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)} disabled={isPending}>
              Never mind
            </Button>
            <Button type="button" variant="destructive" disabled={isPending || !cancelReason.trim()} onClick={handleCancel}>
              {isPending && <Loader2 className="animate-spin" />} Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
