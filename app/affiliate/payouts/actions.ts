'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestPayoutAction() {
  const supabase = await createClient()

  const { error } = await supabase.rpc('request_affiliate_payout')

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/affiliate/payouts')
  revalidatePath('/affiliate')
  return { success: true as const }
}
