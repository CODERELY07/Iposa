import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import StoreOrdersClient from '@/components/marketplace/StoreOrdersClient'
import { updateOrderStatusAction, requestOrderCompletionAction } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellOrdersPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  // Opportunistic sweep: finalizes any 'awaiting_confirmation' order whose
  // customer never responded within order_confirmation_window(). Harmless
  // no-op when nothing is overdue — see auto_confirm_stale_orders().
  await supabase.rpc('auto_confirm_stale_orders')

  const { data: orders, error } = await supabase
    .from('store_orders')
    .select('*, store_order_items(*)')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to load orders: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <StoreOrdersClient
      orders={orders ?? []}
      onUpdateStatus={updateOrderStatusAction}
      onRequestCompletion={requestOrderCompletionAction}
    />
  )
}
