'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addRequestCommentAction(requestId: string, message: string) {
  if (!message.trim()) {
    return { success: false as const, message: 'Message cannot be empty.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_request_comment', {
    p_request_id: requestId,
    p_message: message.trim(),
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath(`/orders/requests/${requestId}`)
  return { success: true as const }
}
