'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { FulfillmentMethod, OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { OrderStatusBadge, FulfillmentBadge } from '@/components/marketplace/StatusBadge'
import { ShieldAlert, Clock3, PackageX, Ban, Flag } from 'lucide-react'

type OrderRow = {
  id: string
  status: OrderStatus
  total: number
  fulfillment_method: FulfillmentMethod
  dispute_reason: string | null
  disputed_from_cancellation: boolean
  cancellation_reason: string | null
  awaiting_confirmation_at: string | null
  created_at: string
  businesses: { name: string; slug: string } | null
  profiles: { full_name: string | null } | null
  store_order_items: StoreOrderItem[]
}

type PendingAction = { orderId: string; resolution: 'completed' | 'cancelled' }

export default function AdminOrdersClient({
  orders,
  onResolve,
}: {
  orders: OrderRow[]
  onResolve: (orderId: string, resolution: 'completed' | 'cancelled') => Promise<{ success: boolean; message?: string }>
}) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  function confirmAction() {
    if (!pendingAction) return
    const { orderId, resolution } = pendingAction
    setBusyId(orderId)
    startTransition(async () => {
      const result = await onResolve(orderId, resolution)
      if (!result.success) {
        toast.error(result.message ?? 'Failed to resolve order.')
      } else {
        toast.success(resolution === 'completed' ? 'Order force-completed.' : 'Order force-refunded.')
        setPendingAction(null)
      }
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-4">
      {orders.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <PackageX className="size-5 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No orders need attention right now.</p>
        </div>
      )}

      {orders.map(order => {
        const busy = isPending && busyId === order.id
        return (
          <Card key={order.id} className="overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-brand-soft px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
                <p className="text-sm font-bold text-foreground">
                  {order.businesses?.name ?? 'Shop'} <span className="font-normal text-muted-foreground">→</span> {order.profiles?.full_name ?? 'Customer'}
                </p>
                <p className="text-[11px] text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <FulfillmentBadge method={order.fulfillment_method} />
                <OrderStatusBadge status={order.status} />
                <span className="font-mono text-sm font-bold text-foreground">₱{Number(order.total).toFixed(2)}</span>
              </div>
            </div>

            {order.status === 'disputed' && order.disputed_from_cancellation && (
              <div className="flex items-start gap-2 border-b bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <Flag className="size-3.5 shrink-0 translate-y-0.5" />
                <div>
                  <p className="font-semibold">Customer reports this shows cancelled but was actually received.</p>
                  {order.dispute_reason && <p className="mt-0.5">They said: &quot;{order.dispute_reason}&quot;</p>}
                  {order.cancellation_reason && (
                    <p className="mt-0.5">Business&apos;s stated cancel reason: &quot;{order.cancellation_reason}&quot;</p>
                  )}
                </div>
              </div>
            )}

            {order.status === 'disputed' && !order.disputed_from_cancellation && order.dispute_reason && (
              <div className="flex items-start gap-2 border-b bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <ShieldAlert className="size-3.5 shrink-0 translate-y-0.5" />
                <span>Customer said: &quot;{order.dispute_reason}&quot;</span>
              </div>
            )}

            {order.status === 'awaiting_confirmation' && (
              <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                <Clock3 className="size-3.5 shrink-0 translate-y-0.5" />
                <span>Business marked this out for delivery — waiting on the customer, or force it below.</span>
              </div>
            )}

            {order.status === 'cancelled' && order.cancellation_reason && (
              <div className="flex items-start gap-2 border-b bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
                <Ban className="size-3.5 shrink-0 translate-y-0.5" />
                <span>Business cancelled: &quot;{order.cancellation_reason}&quot;</span>
              </div>
            )}

            <div className="divide-y">
              {order.store_order_items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-1.5 text-xs">
                  <span className="text-foreground">{item.product_name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                  <span className="font-mono text-muted-foreground">₱{Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/30 p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setPendingAction({ orderId: order.id, resolution: 'cancelled' })}
              >
                Force refund
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={busy}
                onClick={() => setPendingAction({ orderId: order.id, resolution: 'completed' })}
              >
                Force complete
              </Button>
            </div>
          </Card>
        )
      })}

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={open => !open && setPendingAction(null)}
        title={pendingAction?.resolution === 'completed' ? 'Force-complete this order?' : 'Force-refund this order?'}
        description={
          pendingAction?.resolution === 'completed'
            ? "This settles the order as completed regardless of what either the business or customer said — the affiliate commission (if any) becomes payable and the platform's cut is finalized."
            : "This cancels the order and voids any pending affiliate commission on it. Use this when the business's side of the story doesn't hold up."
        }
        confirmLabel={pendingAction?.resolution === 'completed' ? 'Force complete' : 'Force refund'}
        destructive={pendingAction?.resolution !== 'completed'}
        loading={isPending && busyId === pendingAction?.orderId}
        onConfirm={confirmAction}
      />
    </div>
  )
}
