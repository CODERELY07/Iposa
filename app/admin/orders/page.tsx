import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminOrdersClient from '@/components/marketplace/AdminOrdersClient'
import { resolveOrderAction } from './actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Flag } from 'lucide-react'
import type { FulfillmentMethod, OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'

export const revalidate = 0

type AdminOrderRow = {
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

// Disputed orders need eyes on them first; awaiting_confirmation ones are
// where a stalled business would otherwise hide indefinitely — everything
// else (still moving through its normal flow, or already finalized) sorts
// after, newest first within each group.
const PRIORITY: Partial<Record<OrderStatus, number>> = {
  disputed: 0,
  awaiting_confirmation: 1,
}

// One customer report could be an honest mixup; several for the same shop
// is the actual fraud signal worth an admin's attention — see
// business_cancellation_reports in database_schema.sql (SECTION 13).
const FLAG_THRESHOLD = 2

type FlaggedBusiness = {
  business_id: string
  business_name: string
  business_slug: string
  reported_count: number
}

export default async function AdminOrdersPage() {
  const supabase = await createClient()

  // Opportunistic sweep — see auto_confirm_stale_orders() in database_schema.sql.
  await supabase.rpc('auto_confirm_stale_orders')

  const { data: orders, error } = await supabase
    .from('store_orders')
    .select('*, businesses(name, slug), profiles(full_name), store_order_items(*)')
    .order('created_at', { ascending: false })

  const { data: flagged } = await supabase
    .from('business_cancellation_reports')
    .select('*')
    .gte('reported_count', FLAG_THRESHOLD)
    .order('reported_count', { ascending: false })
    .returns<FlaggedBusiness[]>()

  const sorted = ((orders ?? []) as AdminOrderRow[]).sort((a, b) => {
    const pa = PRIORITY[a.status] ?? 2
    const pb = PRIORITY[b.status] ?? 2
    return pa - pb
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Disputed and stalled orders first. Force-complete or force-refund any order regardless of what either side has done.
        </p>
      </div>

      {flagged && flagged.length > 0 && (
        <Alert variant="destructive" className="mb-5">
          <Flag />
          <AlertTitle>Repeat cancellation reports</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              These shops have multiple customer reports of a &quot;cancelled&quot; order actually being received — a
              pattern worth reviewing, not just the individual disputes below.
            </p>
            <ul className="space-y-0.5">
              {flagged.map(b => (
                <li key={b.business_id}>
                  <Link href={`/shop/${b.business_slug}`} className="font-medium underline underline-offset-2">
                    {b.business_name}
                  </Link>{' '}
                  — {b.reported_count} report{b.reported_count === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load orders: {error.message}</AlertDescription>
        </Alert>
      ) : (
        <AdminOrdersClient orders={sorted} onResolve={resolveOrderAction} />
      )}
    </div>
  )
}
