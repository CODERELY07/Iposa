import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { OrderStatusBadge, FulfillmentBadge } from '@/components/marketplace/StatusBadge'
import OrderConfirmationActions from '@/components/marketplace/OrderConfirmationActions'
import ReportCancelledOrder from '@/components/marketplace/ReportCancelledOrder'
import ViewOnMapButton from '@/components/marketplace/ViewOnMapButton'
import { Clock3, ShieldAlert, PackageX, Ban, Sparkles } from 'lucide-react'
import type { OrderStatus, StoreOrder, StoreOrderItem } from '@/lib/types/marketplace'

export const revalidate = 0

// Mirrors order_confirmation_window() in database_schema.sql — display-only.
const CONFIRMATION_WINDOW_DAYS = 4

type OrderWithItems = StoreOrder & {
  businesses: {
    name: string
    slug: string
    address: string | null
    location_lat: number | null
    location_lng: number | null
  } | null
  store_order_items: StoreOrderItem[]
}

// Cart checkouts only — service requests live on their own /services page
// (a customer requesting a repair or a loan isn't "an order" in the
// cart/POS sense, and mixing the two into one list is exactly what made the
// service side easy to overlook here). See /services/page.tsx.
export default async function MyOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Opportunistic sweep: finalizes any 'awaiting_confirmation' order the
  // customer never responded to within the window — see
  // auto_confirm_stale_orders(). Harmless no-op when nothing is overdue.
  await supabase.rpc('auto_confirm_stale_orders')

  const { data: orders, error } = await supabase
    .from('store_orders')
    .select('*, businesses(name, slug, address, location_lat, location_lng), store_order_items(*)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">My orders</h1>
        <Link href="/services" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <Sparkles className="size-3.5" /> Looking for a service you requested?
        </Link>
      </div>

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
        {((orders ?? []) as OrderWithItems[]).map((order) => {
          const deadline = order.awaiting_confirmation_at
            ? new Date(new Date(order.awaiting_confirmation_at).getTime() + CONFIRMATION_WINDOW_DAYS * 86400000)
            : null

          return (
          <Card key={order.id} className="overflow-hidden py-0">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">{order.businesses?.name ?? 'Shop'}</p>
                <p className="text-[11px] text-muted-foreground">
                  Placed {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FulfillmentBadge method={order.fulfillment_method} />
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>
            </div>

            {order.status === 'awaiting_confirmation' && (
              <div className="space-y-2.5 border-b bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
                <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Clock3 className="size-3.5 shrink-0 translate-y-0.5" />
                  <span>
                    {order.businesses?.name ?? 'The shop'} says this is out for delivery — confirm once you&apos;ve got it.
                    {deadline && ` If you don't respond by ${deadline.toLocaleDateString()}, it'll auto-confirm.`}
                  </span>
                </p>
                <OrderConfirmationActions orderId={order.id} />
              </div>
            )}

            {order.status === 'disputed' && (
              <div className="flex items-start gap-2 border-b bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <ShieldAlert className="size-3.5 shrink-0 translate-y-0.5" />
                <span>Your report is being reviewed by MElocalmarketplace support. We&apos;ll follow up soon.</span>
              </div>
            )}

            {order.status === 'cancelled' && (
              <div className="space-y-2.5 border-b bg-muted/50 px-4 py-3">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Ban className="size-3.5 shrink-0 translate-y-0.5" />
                  <span>
                    {order.cancellation_reason
                      ? <>The shop cancelled this: &quot;{order.cancellation_reason}&quot;</>
                      : 'This order was cancelled.'}
                  </span>
                </p>
                <ReportCancelledOrder orderId={order.id} />
              </div>
            )}

            <div className="border-b px-4 py-2.5 text-xs text-muted-foreground">
              {order.fulfillment_method === 'pickup' ? (
                order.businesses?.address ? (
                  <>
                    <span className="font-medium text-foreground">Pick up from:</span> {order.businesses.address}
                    {order.businesses.location_lat != null && order.businesses.location_lng != null && (
                      <ViewOnMapButton
                        className="ml-2"
                        lat={order.businesses.location_lat}
                        lng={order.businesses.location_lng}
                        title={`Pick up from ${order.businesses.name}`}
                        description={order.businesses.address ?? undefined}
                      />
                    )}
                  </>
                ) : (
                  'Pickup — the seller will contact you with the pickup address and timing.'
                )
              ) : (
                <>
                  {order.shipping_address}
                  {order.shipping_lat != null && order.shipping_lng != null && (
                    <ViewOnMapButton
                      className="ml-2"
                      lat={order.shipping_lat}
                      lng={order.shipping_lng}
                      title="Delivery location"
                      description={order.shipping_address ?? undefined}
                      label="View pinned location"
                    />
                  )}
                </>
              )}
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
          )
        })}
      </div>
    </div>
  )
}
