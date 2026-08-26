import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus, StoreOrder, StoreOrderItem } from '@/lib/types/marketplace'

export const revalidate = 0

type OrderWithItems = StoreOrder & {
  businesses: { name: string; slug: string } | null
  store_order_items: StoreOrderItem[]
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  paid: 'bg-blue-50 text-blue-700 border-blue-100',
  processing: 'bg-blue-50 text-blue-700 border-blue-100',
  shipped: 'bg-violet-50 text-violet-700 border-violet-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
}

export default async function MyOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: orders, error } = await supabase
    .from('store_orders')
    .select('*, businesses(name, slug), store_order_items(*)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold text-zinc-900 mb-5">My orders</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load orders: {error.message}
        </div>
      )}

      {!error && (orders ?? []).length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          You haven&apos;t placed any orders yet.
        </div>
      )}

      <div className="space-y-4">
        {((orders ?? []) as OrderWithItems[]).map((order) => (
          <div key={order.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-zinc-900">{order.businesses?.name ?? 'Shop'}</p>
                <p className="text-[11px] text-zinc-400">
                  Placed {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${STATUS_STYLES[order.status as OrderStatus]}`}>
                {order.status}
              </span>
            </div>
            <div className="divide-y divide-zinc-100">
              {(order.store_order_items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-zinc-700">{item.product_name} <span className="text-zinc-400">× {item.quantity}</span></span>
                  <span className="font-mono text-zinc-900">₱{Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-zinc-50/70 border-t border-zinc-100 text-right text-sm font-bold text-zinc-900">
              Total: <span className="font-mono">₱{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
