'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// The customer accepts the business's "done" claim — see
// confirm_order_completion() in database_schema.sql. This is the normal,
// happy-path way an order reaches 'completed'.
export async function confirmOrderAction(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('confirm_order_completion', { p_order_id: orderId })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const }
}

// The customer rejects it — see dispute_order_completion(). Routed to
// super_admin from here, never back to the business.
export async function disputeOrderAction(orderId: string, reason: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('dispute_order_completion', {
    p_order_id: orderId,
    p_reason: reason,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const }
}

// "This shows cancelled, but I actually got it" — see
// report_cancelled_order() in database_schema.sql. Routed to super_admin
// through the same 'disputed' pipeline as disputeOrderAction above; only
// the entry point (a cancelled order, not an awaiting-confirmation one) differs.
export async function reportCancelledOrderAction(orderId: string, reason: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('report_cancelled_order', {
    p_order_id: orderId,
    p_reason: reason,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const }
}
