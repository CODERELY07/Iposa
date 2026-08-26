'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/lib/types/marketplace'

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { error } = await supabase
    .from('store_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('business_id', business.id)

  if (error) throw new Error(error.message)

  revalidatePath('/sell/orders')
}
