'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { RequestFulfillmentMethod } from '@/lib/types/marketplace'

export async function submitServiceRequestAction(payload: {
  offeringId: number
  formData: Record<string, unknown>
  location: { address: string; lat: number; lng: number }
  fulfillmentMethod: RequestFulfillmentMethod | null
  customerNotes: string | null
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false as const, message: 'Please log in to send a request.' }
  }

  // Required on every custom offering's request — re-checked here (and,
  // ultimately, inside submit_service_request() itself) since this action is
  // a public endpoint regardless of what the form UI enforces.
  if (!payload.location?.address || payload.location.lat == null || payload.location.lng == null) {
    return { success: false as const, message: 'Confirm a location on the map before sending this request.' }
  }

  const { data, error } = await supabase.rpc('submit_service_request', {
    p_offering_id: payload.offeringId,
    p_form_data: payload.formData,
    p_location_address: payload.location.address,
    p_location_lat: payload.location.lat,
    p_location_lng: payload.location.lng,
    p_fulfillment_method: payload.fulfillmentMethod,
    p_customer_notes: payload.customerNotes,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/orders')
  return { success: true as const, requestId: data?.id as string | undefined }
}

// File fields upload before the service_requests row exists (the customer
// is still filling out the form), so there's no request id yet to scope the
// storage path to — objects go under the uploader's own uid instead, which
// is also exactly what the storage RLS policy on this bucket checks against
// (see database_schema.sql SECTION 14.8). Passed straight through as
// DynamicOfferingRequestForm's onUploadFile prop — a Server Action ('use
// server', above) is the one kind of function a Server Component can hand a
// Client Component directly, no wrapper needed.
export async function uploadServiceRequestFileAction(file: File) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please log in to attach a file.')
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`

  const { error } = await supabase.storage.from('service-request-uploads').upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) {
    throw new Error(error.message)
  }

  const { data: publicUrl } = supabase.storage.from('service-request-uploads').getPublicUrl(path)

  return { url: publicUrl.publicUrl, filename: file.name, uploaded_at: new Date().toISOString() }
}
