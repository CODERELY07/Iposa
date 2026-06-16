'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function voidTransactionAction(saleId: number, pinCode: string) {
    const supabase = await createClient()

    if (!pinCode || pinCode.length !== 4) {
        return { success: false, message: 'Invalid format. PIN must be 4 digits.' }
    }

    // 1. Authenticate PIN against the security ledger table
    const { data: managerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('manager_pin', pinCode)
        .eq('role', 'user')
        .single();

    

    if (profileError || !managerProfile) {
        console.error("❌ VOID TRANSACTION PIN FAILURE LOG:", {
            dbError: profileError,
            foundPayload: managerProfile,
            submittedPin: pinCode
        });
        
        return { 
            success: false, 
            message: profileError 
                ? `Database Error: ${profileError.message}` 
                : 'Authentication Failure: PIN does not match an authorized account record.',
            debugDetails: {
                hasError: !!profileError,
                foundRecord: !!managerProfile,
                receivedPinLength: pinCode?.length
            }
        };
    }

// 2. Erase record. ON DELETE CASCADE cleans up sale_items, 
// triggering the DB function to restore stock automatically.
    const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId)

    if (deleteError) {
        return { success: false, message: `Voiding aborted: ${deleteError.message}` }
    }

    revalidatePath('/sales-history')
    return { success: true, message: 'Transaction successfully voided and inventory stock replenished.' }
}