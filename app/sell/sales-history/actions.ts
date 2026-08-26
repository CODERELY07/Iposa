'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function voidTransactionAction(saleId: number, pinCode: string) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  if (!pinCode || pinCode.length !== 4) {
    return { success: false, message: 'Invalid format. PIN must be 4 digits.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, message: 'Not authenticated.' }
  }

  // Self-check: with no per-business staff accounts yet, the "manager PIN"
  // is just a deliberate confirmation step for the owner's own account
  // (guards against an accidental click), not an authorization handoff to
  // someone else.
  const { data: ownProfile, error: profileError } = await supabase
    .from('profiles')
    .select('manager_pin')
    .eq('id', user.id)
    .single()

  if (profileError || !ownProfile?.manager_pin || ownProfile.manager_pin !== pinCode) {
    return { success: false, message: 'Incorrect PIN. Set your PIN in Account settings if you haven\'t yet.' }
  }

  // ON DELETE CASCADE cleans up sale_items, which triggers the DB function
  // that restores stock/ingredients automatically. RLS also guarantees this
  // sale belongs to the caller's own business.
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .eq('id', saleId)
    .eq('business_id', business.id)

  if (deleteError) {
    return { success: false, message: `Voiding aborted: ${deleteError.message}` }
  }

  revalidatePath('/sell/sales-history')
  return { success: true, message: 'Transaction successfully voided and inventory stock replenished.' }
}
