import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import StoreOrdersClient from '@/components/marketplace/StoreOrdersClient'
import { updateOrderStatusAction } from './actions'

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
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to load orders: {error.message}
      </div>
    )
  }

  return <StoreOrdersClient orders={orders ?? []} onUpdateStatus={updateOrderStatusAction} />
}
