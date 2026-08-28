'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CartItem, FulfillmentMethod } from '@/lib/types/marketplace'

export async function placeOrderAction(
  items: CartItem[],
  shipping: {
    name: string
    phone: string
    address: string
    notes?: string
    fulfillmentMethod: FulfillmentMethod
    lat?: number | null
    lng?: number | null
  }
) {
  const supabase = await createClient()

  // Required, not optional, for delivery — mirrors the client-side check in
  // CheckoutForm; re-checked here since a server action is a public endpoint
  // regardless of what the form UI allows. place_order() also enforces this
  // (belt-and-suspenders), but failing fast here skips the RPC round-trip.
  if (shipping.fulfillmentMethod === 'delivery' && (shipping.lat == null || shipping.lng == null)) {
    return { success: false as const, message: 'Confirm your exact delivery location on the map before placing your order.' }
  }

  // Each item's ref_code (if any) was stamped client-side at the moment it
  // was added to the cart from a specific product's page — see
  // ProductPageActions. place_order() only credits the items that actually
  // carry one, never the whole order.
  const { data, error } = await supabase.rpc('place_order', {
    p_items: items.map(i => ({ product_id: i.productId, quantity: i.quantity, ref_code: i.refCode ?? null })),
    p_shipping_name: shipping.name,
    p_shipping_phone: shipping.phone,
    p_shipping_address: shipping.address,
    p_notes: shipping.notes || null,
    p_fulfillment_method: shipping.fulfillmentMethod,
    p_shipping_lat: shipping.lat ?? null,
    p_shipping_lng: shipping.lng ?? null,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const, orders: data }
}
