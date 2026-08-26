'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CartItem } from '@/lib/types/marketplace'

export async function placeOrderAction(
  items: CartItem[],
  shipping: { name: string; phone: string; address: string; notes?: string }
) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('place_order', {
    p_items: items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
    p_shipping_name: shipping.name,
    p_shipping_phone: shipping.phone,
    p_shipping_address: shipping.address,
    p_notes: shipping.notes || null,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const, orders: data }
}
