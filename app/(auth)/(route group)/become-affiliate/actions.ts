'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function registerAffiliateAction(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  // payout_details now holds a contact phone number, not account details —
  // this platform has no payment gateway, so every commission is cash,
  // handed over in person by the referred shop (see RegisterAffiliateForm).
  // payout_method is always 'Cash': it's the only method that ever exists
  // here, so there's nothing left for the form to ask about.
  const payoutDetails = String(formData.get('payout_details') ?? '').trim() || null

  if (!fullName) {
    return { success: false as const, message: 'Full name is required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_affiliate', {
    p_full_name: fullName,
    p_payout_method: 'Cash',
    p_payout_details: payoutDetails,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  redirect('/affiliate')
}
