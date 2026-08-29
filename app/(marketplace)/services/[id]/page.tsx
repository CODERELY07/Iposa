import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { addRequestCommentAction } from './actions'
import FieldRenderer from '@/components/offerings/FieldRenderer'
import RequestTimeline from '@/components/offerings/RequestTimeline'
import ViewOnMapButton from '@/components/marketplace/ViewOnMapButton'
import { ServiceRequestStatusBadge } from '@/components/marketplace/StatusBadge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, MapPinned } from 'lucide-react'
import type { ServiceRequest, ServiceRequestEvent, ServiceRequestStatus, OfferingField } from '@/lib/types/marketplace'

export const revalidate = 0

type RequestDetail = ServiceRequest & {
  offerings: { name: string; metadata_schema: OfferingField[] } | null
  businesses: { name: string; slug: string } | null
}

export default async function ServiceRequestTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const [{ data: request }, { data: events }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('*, offerings(name, metadata_schema), businesses(name, slug)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .maybeSingle<RequestDetail>(),
    supabase
      .from('service_request_events')
      .select('*')
      .eq('request_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!request) {
    notFound()
  }

  async function handleComment(message: string) {
    'use server'
    return addRequestCommentAction(id, message)
  }

  const schema = request.offerings?.metadata_schema ?? []
  const customerFields = schema.filter(field => !field.admin_only)
  // admin_only fields are still never part of the form the customer fills
  // out (see DynamicOfferingRequestForm) — they don't know to answer
  // something the shop hasn't asked them yet. But once the shop has actually
  // set a value, the customer can see it here: it's shop-entered detail
  // about their own request (an assigned technician, a diagnosis code...),
  // not a private admin channel. Only shown once populated, so a still-empty
  // internal field doesn't read as "the shop owes you an answer."
  const shopFields = schema.filter(field => field.admin_only && !isEmptyValue(request.form_data?.[field.key]))

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/services" className="hover:text-foreground">My services</Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-foreground">{request.offerings?.name ?? 'Request'}</span>
      </nav>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">{request.offerings?.name ?? 'Request'}</h1>
          <Link href={`/shop/${request.businesses?.slug}`} className="text-sm text-muted-foreground hover:text-primary">
            {request.businesses?.name ?? 'Shop'}
          </Link>
        </div>
        <ServiceRequestStatusBadge status={request.status as ServiceRequestStatus} />
      </div>

      {request.quoted_price != null && request.status !== 'rejected' && (
        <Card className="mb-5 flex items-center justify-between border-primary/20 bg-primary/5 p-4">
          <span className="text-sm text-foreground">Quoted price</span>
          <span className="font-mono text-lg font-bold text-foreground">₱{Number(request.quoted_price).toFixed(2)}</span>
        </Card>
      )}

      {request.rejection_reason && (
        <Card className="mb-5 border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {request.businesses?.name ?? 'The shop'} declined this: &quot;{request.rejection_reason}&quot;
        </Card>
      )}

      <Card className="mb-5 p-5">
        <h2 className="label-mono mb-3">What you submitted</h2>
        <div className="space-y-3">
          {request.location_address && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                <MapPinned className="size-3.5 shrink-0 text-primary" /> {request.location_address}
                {request.location_lat != null && request.location_lng != null && (
                  <ViewOnMapButton
                    lat={request.location_lat}
                    lng={request.location_lng}
                    title={request.offerings?.name ?? 'Request location'}
                    description={request.location_address}
                    className="ml-1"
                  />
                )}
              </p>
            </div>
          )}
          {customerFields.map(field => (
            <FieldRenderer key={field.key} field={field} value={request.form_data?.[field.key]} readOnly />
          ))}
          {request.customer_notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="whitespace-pre-line text-sm text-foreground">{request.customer_notes}</p>
            </div>
          )}
        </div>
      </Card>

      {shopFields.length > 0 && (
        <Card className="mb-5 p-5">
          <h2 className="label-mono mb-3">Details from {request.businesses?.name ?? 'the shop'}</h2>
          <div className="space-y-3">
            {shopFields.map(field => (
              <FieldRenderer key={field.key} field={field} value={request.form_data?.[field.key]} readOnly />
            ))}
          </div>
        </Card>
      )}

      <Separator className="mb-5" />

      <Card className="p-5">
        <h2 className="label-mono mb-3">Updates</h2>
        <RequestTimeline
          events={(events ?? []) as ServiceRequestEvent[]}
          viewerRole="customer"
          onComment={handleComment}
          placeholder="Ask a question or confirm details…"
        />
      </Card>
    </div>
  )
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}
