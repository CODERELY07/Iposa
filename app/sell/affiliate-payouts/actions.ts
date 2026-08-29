'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// set_affiliate_payout_status() (SECURITY DEFINER) checks that the caller
// owns the business this specific payout is scoped to — see
// database_schema.sql — so there's nothing further to authorize here.
export async function reviewBusinessPayoutAction(payoutId: string, status: 'paid' | 'rejected') {
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_affiliate_payout_status', {
    p_payout_id: payoutId,
    p_status: status,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/affiliate-payouts')
  return { success: true as const }
}
