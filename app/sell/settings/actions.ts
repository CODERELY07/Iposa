'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateBusinessSettingsAction(payload: {
  name: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
}) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  if (!payload.name.trim()) {
    return { success: false as const, message: 'Shop name is required.' }
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      name: payload.name.trim(),
      description: payload.description,
      logo_url: payload.logo_url,
      banner_url: payload.banner_url,
    })
    .eq('id', business.id)

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/settings')
  revalidatePath(`/shop/${business.slug}`)
  return { success: true as const }
}

// The PIN confirms a void-transaction request in POS Sales History (a
// deliberate second step, not an authorization handoff — there are no
// per-business staff accounts yet, so it's always your own account).
export async function updateManagerPinAction(pin: string) {
  await requireApprovedBusiness()
  const supabase = await createClient()

  if (!/^\d{4}$/.test(pin)) {
    return { success: false as const, message: 'PIN must be exactly 4 digits.' }
  }

  const { error } = await supabase.rpc('update_manager_pin', { p_pin: pin })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/settings')
  return { success: true as const }
}
