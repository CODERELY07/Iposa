'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/lib/types/marketplace'

// 'awaiting_confirmation' is directly settable now — opening the customer's
// confirmation window used to be a separate "mark as done" RPC
// (request_order_completion()), which let the business choose the moment
// it became answerable to the customer. It's just another status now; the
// database's own trg_stamp_awaiting_confirmation stamps the timestamp, and
// trg_enforce_order_status_rules is what actually stops the business from
// reversing it afterward — not this allowlist. 'cancelled' goes through
// cancelOrderAction below instead, since it requires a reason this path has
// nowhere to carry.
const DIRECTLY_SETTABLE: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'awaiting_confirmation']

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  if (!DIRECTLY_SETTABLE.includes(status)) {
    throw new Error(`Can't set an order to ${status.replace(/_/g, ' ')} directly.`)
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

// Cancelling always requires a reason — see cancellation_reason and
// trg_enforce_order_status_rules in database_schema.sql. It's shown to the
// customer, and it's the record a customer can later contradict via
// report_cancelled_order() if the order shows cancelled but actually
// arrived — the platform's only real signal against cancel-but-still-fulfill
// without a payment gateway in the loop.
export async function cancelOrderAction(orderId: string, reason: string) {
  if (!reason.trim()) {
    return { success: false as const, message: 'A cancellation reason is required.' }
  }

  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { error } = await supabase
    .from('store_orders')
    .update({ status: 'cancelled', cancellation_reason: reason.trim() })
    .eq('id', orderId)
    .eq('business_id', business.id)

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders')
  return { success: true as const }
}
