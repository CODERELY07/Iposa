import { createClient } from '@/lib/supabase/server'
import AdminOrdersClient from '@/components/marketplace/AdminOrdersClient'
import { resolveOrderAction } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { OrderStatus, StoreOrderItem } from '@/lib/types/marketplace'

export const revalidate = 0

type AdminOrderRow = {
  id: string
  status: OrderStatus
  total: number
  dispute_reason: string | null
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

export default async function AdminOrdersPage() {
  const supabase = await createClient()

  // Opportunistic sweep — see auto_confirm_stale_orders() in database_schema.sql.
  await supabase.rpc('auto_confirm_stale_orders')

  const { data: orders, error } = await supabase
    .from('store_orders')
    .select('*, businesses(name, slug), profiles(full_name), store_order_items(*)')
    .order('created_at', { ascending: false })

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
