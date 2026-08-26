'use client'

import { useState, useTransition } from 'react'
import type { OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'

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

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  paid: 'bg-blue-50 text-blue-700 border-blue-100',
  processing: 'bg-blue-50 text-blue-700 border-blue-100',
  shipped: 'bg-violet-50 text-violet-700 border-violet-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
}

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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Orders</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{orders.length} orders total</p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>}

      {orders.length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No orders yet.
        </div>
      )}

      {orders.map(order => (
        <div key={order.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-zinc-400 font-mono">#{order.id.slice(0, 8)}</p>
              <p className="text-sm font-bold text-zinc-900">{order.shipping_name ?? 'Customer'}</p>
              <p className="text-[11px] text-zinc-400">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${STATUS_STYLES[order.status]}`}>
                {order.status}
              </span>
              <select
                value={order.status}
                disabled={isPending && busyId === order.id}
                onChange={e => handleChange(order.id, e.target.value as OrderStatus)}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {STATUS_FLOW.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Items</p>
              <div className="space-y-1 text-sm">
                {order.store_order_items.map(item => (
                  <div key={item.id} className="flex justify-between text-zinc-700">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span className="font-mono">₱{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-900 mt-2 pt-2 border-t border-zinc-100">
                <span>Total</span>
                <span className="font-mono">₱{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Delivery</p>
              <p className="text-sm text-zinc-700">{order.shipping_phone}</p>
              <p className="text-sm text-zinc-700">{order.shipping_address}</p>
              {order.notes && <p className="text-xs text-zinc-400 mt-1 italic">&quot;{order.notes}&quot;</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
