'use client'

import { useState, useTransition } from 'react'
import type { OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrderStatusBadge } from '@/components/marketplace/StatusBadge'
import { AlertCircle, PackageX } from 'lucide-react'

type OrderRow = {
  id: string
  status: OrderStatus
  total: number
  shipping_name: string | null
  shipping_phone: string | null
  shipping_address: string | null
  notes: string | null
  created_at: string
  store_order_items: StoreOrderItem[]
}

const STATUS_FLOW: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled']

export default function StoreOrdersClient({
  orders,
  onUpdateStatus,
}: {
  orders: OrderRow[]
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      {orders.map(order => (
        <Card key={order.id} className="overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-brand-soft px-4 py-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
              <p className="text-sm font-bold text-foreground">{order.shipping_name ?? 'Customer'}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <Select
                value={order.status}
                disabled={isPending && busyId === order.id}
                onValueChange={value => handleChange(order.id, value as OrderStatus)}
              >
                <SelectTrigger size="sm" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              <p className="mb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Delivery</p>
              <p className="text-sm text-foreground">{order.shipping_phone}</p>
              <p className="text-sm text-foreground">{order.shipping_address}</p>
              {order.notes && <p className="mt-1 text-xs italic text-muted-foreground">&quot;{order.notes}&quot;</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
