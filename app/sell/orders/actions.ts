'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/lib/types/marketplace'

// Only the pre-confirmation statuses are reachable this way — the database's
// own store_orders UPDATE policy rejects 'awaiting_confirmation', 'completed',
// and 'disputed' from a business owner regardless of what this action sends,
// so this check just gives a clearer error than a raw RLS failure would.
const DIRECTLY_SETTABLE: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'cancelled']

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  if (!DIRECTLY_SETTABLE.includes(status)) {
    throw new Error(`Use "Mark as done" to move an order to ${status.replace(/_/g, ' ')}.`)
  }

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

// The business claims the order is done. Opens the customer's confirmation
// window instead of finalizing anything itself — see request_order_completion()
// in database_schema.sql.
export async function requestOrderCompletionAction(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('request_order_completion', { p_order_id: orderId })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders')
  return { success: true as const }
}
