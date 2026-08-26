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
