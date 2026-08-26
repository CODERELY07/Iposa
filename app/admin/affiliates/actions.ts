'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reviewAffiliateAction(affiliateId: string, status: 'approved' | 'rejected', reason?: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_affiliate_status', {
    p_affiliate_id: affiliateId,
    p_status: status,
    p_rejection_reason: reason || null,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/admin/affiliates')
  return { success: true as const }
}
