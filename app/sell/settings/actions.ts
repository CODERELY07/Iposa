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

// Where customers pick up a 'pickup' order from — see MapLocationPicker on
// the settings page and the pickup block on the shop page / customer's own
// orders list, which fall back to "the seller will reach out" copy when
// these are unset. A plain owner-scoped write, same as the settings form
// above — no cross-table invariant to protect.
export async function updateBusinessLocationAction(payload: {
  address: string | null
  location_lat: number | null
  location_lng: number | null
}) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  // Required, not optional — mirrors the client-side check in
  // BusinessLocationForm; re-checked here since a server action is a public
  // endpoint regardless of what the form UI allows.
  if (payload.location_lat == null || payload.location_lng == null) {
    return { success: false as const, message: 'A map pin is required for your pickup location.' }
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      address: payload.address,
      location_lat: payload.location_lat,
      location_lng: payload.location_lng,
    })
    .eq('id', business.id)

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/settings')
  revalidatePath(`/shop/${business.slug}`)
  return { success: true as const }
}

// Upserts this business's affiliate-program settings (one row per business).
// A plain owner-scoped RLS write, not an RPC — there's no cross-table
// invariant to protect here, unlike register_business()/process_sale().
export async function updateAffiliateSettingsAction(payload: {
  enabled: boolean
  commission_rate: number
  service_commission_amount: number
}) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  if (!Number.isFinite(payload.commission_rate) || payload.commission_rate < 0 || payload.commission_rate > 100) {
    return { success: false as const, message: 'Commission rate must be between 0 and 100.' }
  }
  if (!Number.isFinite(payload.service_commission_amount) || payload.service_commission_amount < 0) {
    return { success: false as const, message: 'Service commission amount must be 0 or greater.' }
  }

  const { error } = await supabase
    .from('business_affiliate_settings')
    .upsert({
      business_id: business.id,
      enabled: payload.enabled,
      commission_rate: payload.commission_rate,
      service_commission_amount: payload.service_commission_amount,
    })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/settings')
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
