'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function registerAffiliateAction(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const payoutMethod = String(formData.get('payout_method') ?? '').trim() || null
  const payoutDetails = String(formData.get('payout_details') ?? '').trim() || null

  if (!fullName) {
    return { success: false as const, message: 'Full name is required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_affiliate', {
    p_full_name: fullName,
    p_payout_method: payoutMethod,
    p_payout_details: payoutDetails,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  redirect('/affiliate')
}
