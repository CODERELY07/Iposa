import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import StoreOrdersClient from '@/components/marketplace/StoreOrdersClient'
import RequestsKanbanClient, { type RequestWithRelations } from '@/components/business/RequestsKanbanClient'
import {
  updateOrderStatusAction,
  cancelOrderAction,
  updateServiceRequestAction,
  addRequestCommentAction,
  logWalkinServiceRequestAction,
  updateRequestAdminFieldsAction,
} from './actions'
import { uploadServiceRequestFileAction } from '@/app/(marketplace)/shop/[slug]/service/[offeringSlug]/actions'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Receipt, Sparkles } from 'lucide-react'
import type { ServiceRequestEvent, Offering } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function SellOrdersAndRequestsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  // Opportunistic sweep: finalizes any 'awaiting_confirmation' order whose
  // customer never responded within order_confirmation_window(). Harmless
  // no-op when nothing is overdue — see auto_confirm_stale_orders().
  await supabase.rpc('auto_confirm_stale_orders')

  const [{ data: orders, error: ordersError }, { data: requests, error: requestsError }, { data: customOfferings }] = await Promise.all([
    supabase
      .from('store_orders')
      .select('*, store_order_items(*)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_requests')
      .select('*, offerings(name, metadata_schema), customer:profiles(full_name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    // Offered to the "log a walk-in" picker — only the offerings a customer
    // could actually request online, since a walk-in is standing in for
    // exactly that same submission, just entered by the owner instead.
    supabase
      .from('offerings')
      .select('*')
      .eq('business_id', business.id)
      .eq('requires_pos', false)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const requestIds = (requests ?? []).map(r => r.id)
  const { data: events } =
    requestIds.length > 0
      ? await supabase
          .from('service_request_events')
          .select('*')
          .in('request_id', requestIds)
          .order('created_at', { ascending: true })
      : { data: [] }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Orders &amp; Requests</h1>
        <p className="text-sm text-muted-foreground">Cart checkouts and custom requests, kept separate — nothing here touches the other.</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList variant="line">
          <TabsTrigger value="orders"><Receipt className="size-4" /> Online Orders</TabsTrigger>
          <TabsTrigger value="requests">
            <Sparkles className="size-4" /> Requests
            {(requests ?? []).filter(r => r.status === 'submitted').length > 0 && (
              <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {(requests ?? []).filter(r => r.status === 'submitted').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {ordersError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>Failed to load orders: {ordersError.message}</AlertDescription>
            </Alert>
          ) : (
            <StoreOrdersClient
              orders={orders ?? []}
              onUpdateStatus={updateOrderStatusAction}
              onCancel={cancelOrderAction}
              hasPickupLocation={Boolean(business.address)}
            />
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {requestsError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>Failed to load requests: {requestsError.message}</AlertDescription>
            </Alert>
          ) : (
            <RequestsKanbanClient
              initialRequests={(requests ?? []) as unknown as RequestWithRelations[]}
              initialEvents={(events ?? []) as ServiceRequestEvent[]}
              offerings={(customOfferings ?? []) as Offering[]}
              onUpdateAction={updateServiceRequestAction}
              onCommentAction={addRequestCommentAction}
              onLogWalkinAction={logWalkinServiceRequestAction}
              onUpdateAdminFieldsAction={updateRequestAdminFieldsAction}
              onUploadFile={uploadServiceRequestFileAction}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
