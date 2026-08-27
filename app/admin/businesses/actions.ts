'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reviewBusinessAction(businessId: string, status: 'approved' | 'rejected', reason?: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_business_status', {
    p_business_id: businessId,
    p_status: status,
    p_rejection_reason: reason || null,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/admin/businesses')
  return { success: true as const }
}

// business_type is otherwise locked once an owner registers (see
// protect_business_type() in database_schema.sql) — this is the one path
// that can still change it, and it also reconciles that business's existing
// store_products.track_stock/stock so POS/checkout don't silently disagree
// with the corrected type (see set_business_type() in the same file).
export async function changeBusinessTypeAction(businessId: string, businessType: 'restaurant' | 'services' | 'retail') {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_business_type', {
    p_business_id: businessId,
    p_business_type: businessType,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/admin/businesses')
  revalidatePath('/sell')
  return { success: true as const }
}
