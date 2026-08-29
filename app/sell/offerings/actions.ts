'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OfferingField, FulfillmentType } from '@/lib/types/marketplace'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// This page only ever manages custom (requires_pos = false) offerings — a
// retail item's offerings row is a mirror maintained automatically by
// trg_sync_offering_for_product whenever a product is saved on /sell/products
// (see database_schema.sql SECTION 14.2), and both the guard trigger there
// and this action's own hardcoded `requires_pos: false` keep the two paths
// from ever colliding.
type OfferingPayload = {
  id: number | null
  name: string
  category_id: number | null
  description: string | null
  image_url: string | null
  fulfillment_type: FulfillmentType
  price: number | null
  price_label: string | null
  metadata_schema: OfferingField[]
  is_active: boolean
  sort_order: number
}

export async function saveOfferingAction(payload: OfferingPayload) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const itemPayload = {
    name: payload.name,
    category_id: payload.category_id,
    description: payload.description,
    image_url: payload.image_url,
    requires_pos: false,
    linked_product_id: null,
    fulfillment_type: payload.fulfillment_type,
    price: payload.price,
    price_label: payload.price_label,
    metadata_schema: payload.metadata_schema,
    is_active: payload.is_active,
    sort_order: payload.sort_order,
  }

  if (payload.id) {
    const { error } = await supabase
      .from('offerings')
      .update(itemPayload)
      .eq('id', payload.id)
      .eq('business_id', business.id)
      .eq('requires_pos', false)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('offerings').insert({
      ...itemPayload,
      business_id: business.id,
      slug: `${slugify(payload.name)}-${Math.random().toString(36).slice(2, 7)}`,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/sell/offerings')
  revalidatePath(`/shop/${business.slug}`)
}

export async function deleteOfferingAction(id: number) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  // requires_pos = false in the filter is belt-and-suspenders: even without
  // it, trg_protect_offering_pos_delete already refuses to remove a
  // POS-linked row from anywhere but the Products page.
  const { error } = await supabase.from('offerings').delete().eq('id', id).eq('business_id', business.id).eq('requires_pos', false)
  if (error) throw new Error(error.message)

  revalidatePath('/sell/offerings')
  revalidatePath(`/shop/${business.slug}`)
}
