'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus, ServiceRequest, ServiceRequestStatus, RequestFulfillmentMethod } from '@/lib/types/marketplace'
import * as ordersActions from '../orders/actions'

// Thin async wrappers rather than duplicated logic: the POS/online-orders
// tab on this page is the exact same store_orders code that lived at
// /sell/orders (see app/sell/orders/page.tsx, now a redirect) — just called
// through here, since a "use server" file may only export async functions
// (a bare `export { x } from ...` re-export isn't allowed).
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  return ordersActions.updateOrderStatusAction(orderId, status)
}

export async function cancelOrderAction(orderId: string, reason: string) {
  return ordersActions.cancelOrderAction(orderId, reason)
}

export async function updateServiceRequestAction(payload: {
  requestId: string
  status?: ServiceRequestStatus
  message?: string
  quotedPrice?: number
  agreedPrice?: number
  rejectionReason?: string
}) {
  await requireApprovedBusiness()
  const supabase = await createClient()

  const { error } = await supabase.rpc('update_service_request', {
    p_request_id: payload.requestId,
    p_status: payload.status ?? null,
    p_message: payload.message ?? null,
    p_quoted_price: payload.quotedPrice ?? null,
    p_agreed_price: payload.agreedPrice ?? null,
    p_rejection_reason: payload.rejectionReason ?? null,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders-and-requests')
  return { success: true as const }
}

// A walk-in came into the shop and doesn't use the app — the owner fills out
// the same offering.metadata_schema form on their behalf instead. Location is
// optional here (unlike the customer's own online form): the customer is
// standing in front of the owner, so there's often nothing to pin.
export async function logWalkinServiceRequestAction(payload: {
  offeringId: number
  formData: Record<string, unknown>
  customerName: string
  customerPhone: string | null
  location: { address: string; lat: number; lng: number } | null
  fulfillmentMethod: RequestFulfillmentMethod | null
  customerNotes: string | null
  ownerNotes: string | null
}) {
  await requireApprovedBusiness()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('log_walkin_service_request', {
    p_offering_id: payload.offeringId,
    p_form_data: payload.formData,
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_location_address: payload.location?.address ?? null,
    p_location_lat: payload.location?.lat ?? null,
    p_location_lng: payload.location?.lng ?? null,
    p_fulfillment_method: payload.fulfillmentMethod,
    p_customer_notes: payload.customerNotes,
    p_owner_notes: payload.ownerNotes,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders-and-requests')
  return { success: true as const, request: data as ServiceRequest }
}

// Saves the offering's admin_only field values on this one request — the
// structured, per-field alternative to the single owner_notes text box.
// Never touches a customer-submitted key: update_request_admin_fields()
// rejects any patch key that isn't actually defined as admin_only on the
// offering's own schema.
export async function updateRequestAdminFieldsAction(requestId: string, patch: Record<string, unknown>) {
  await requireApprovedBusiness()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('update_request_admin_fields', {
    p_request_id: requestId,
    p_patch: patch,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders-and-requests')
  return { success: true as const, request: data as ServiceRequest }
}

export async function addRequestCommentAction(requestId: string, message: string) {
  if (!message.trim()) {
    return { success: false as const, message: 'Message cannot be empty.' }
  }

  await requireApprovedBusiness()
  const supabase = await createClient()

  const { error } = await supabase.rpc('add_request_comment', {
    p_request_id: requestId,
    p_message: message.trim(),
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  revalidatePath('/sell/orders-and-requests')
  return { success: true as const }
}
