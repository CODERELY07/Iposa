import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import StoreOrdersClient from '@/components/marketplace/StoreOrdersClient'
import { updateOrderStatusAction } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellOrdersPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

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

  return <StoreOrdersClient orders={orders ?? []} onUpdateStatus={updateOrderStatusAction} />
}
