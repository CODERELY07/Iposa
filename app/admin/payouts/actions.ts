'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reviewPayoutAction(payoutId: string, status: 'paid' | 'rejected') {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_affiliate_payout_status', {
    p_payout_id: payoutId,
    p_status: status,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/admin/payouts')
  return { success: true as const }
}
