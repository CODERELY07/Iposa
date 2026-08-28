'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// super_admin's backstop, independent of both parties — see
// admin_resolve_order() in database_schema.sql. Used both to resolve a
// 'disputed' order and to force-settle one a business is simply sitting on.
export async function resolveOrderAction(orderId: string, resolution: 'completed' | 'cancelled') {
  const supabase = await createClient()

  const { error } = await supabase.rpc('admin_resolve_order', {
    p_order_id: orderId,
    p_resolution: resolution,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/admin/orders')
  return { success: true as const }
}
