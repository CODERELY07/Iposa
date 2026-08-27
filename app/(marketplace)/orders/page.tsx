import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/marketplace/StatusBadge'
import { PackageX } from 'lucide-react'
import type { OrderStatus, StoreOrder, StoreOrderItem } from '@/lib/types/marketplace'

export const revalidate = 0

type OrderWithItems = StoreOrder & {
  businesses: { name: string; slug: string } | null
  store_order_items: StoreOrderItem[]
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-5 font-serif text-2xl font-normal tracking-tight text-foreground">My orders</h1>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load orders: {error.message}
        </div>
      )}

      {!error && (orders ?? []).length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <PackageX className="size-6 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">You haven&apos;t placed any orders yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {((orders ?? []) as OrderWithItems[]).map((order) => (
          <Card key={order.id} className="overflow-hidden py-0">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">{order.businesses?.name ?? 'Shop'}</p>
                <p className="text-[11px] text-muted-foreground">
                  Placed {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
            <div className="divide-y">
              {(order.store_order_items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-foreground">{item.product_name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                  <span className="font-mono text-foreground">₱{Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t bg-muted/30 px-4 py-2.5 text-right text-sm font-bold text-foreground">
              Total: <span className="font-mono">₱{Number(order.total).toFixed(2)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
