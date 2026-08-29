'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Offering, ServiceRequest, ServiceRequestEvent, ServiceRequestStatus, OfferingField, RequestFulfillmentMethod, UploadedFile } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ServiceRequestStatusBadge } from '@/components/marketplace/StatusBadge'
import FieldRenderer from '@/components/offerings/FieldRenderer'
import RequestTimeline from '@/components/offerings/RequestTimeline'
import DeliveryNavigateButton from '@/components/marketplace/DeliveryNavigateButton'
import LogWalkinRequestDialog from '@/components/business/LogWalkinRequestDialog'
import { SERVICE_REQUEST_STATUS_LABELS, nextStatuses } from '@/lib/offerings/field-schema'
import { Loader2, User, Clock3, MapPinned, UserPlus, Store } from 'lucide-react'

// A request's customer_id is null for a walk-in the owner logged in person
// (see log_walkin_service_request()) — walk_in_name stands in for the
// customer's own account name in that case.
function customerDisplayName(request: Pick<RequestWithRelations, 'customer' | 'walk_in_name'>) {
  return request.customer?.full_name ?? request.walk_in_name ?? 'Customer'
}

// A per-card status Select stands in for drag-and-drop — this app has no DnD
// library, and a dropdown constrained to nextStatuses() gives the same
// "move the ticket forward" action with the legal-transition guardrail
// visible instead of hidden behind a failed drop.
const BOARD_COLUMNS: ServiceRequestStatus[] = ['submitted', 'in_review', 'accepted', 'in_progress', 'awaiting_customer', 'completed']
const CLOSED_STATUSES: ServiceRequestStatus[] = ['rejected', 'cancelled']

export type RequestWithRelations = ServiceRequest & {
  offerings: { name: string; metadata_schema: OfferingField[] } | null
  customer: { full_name: string | null } | null
}

type UpdatePayload = {
  requestId: string
  status?: ServiceRequestStatus
  message?: string
  quotedPrice?: number
  agreedPrice?: number
  rejectionReason?: string
}

type WalkinPayload = {
  offeringId: number
  formData: Record<string, unknown>
  customerName: string
  customerPhone: string | null
  location: { address: string; lat: number; lng: number } | null
  fulfillmentMethod: RequestFulfillmentMethod | null
  customerNotes: string | null
  ownerNotes: string | null
}

export default function RequestsKanbanClient({
  initialRequests,
  initialEvents,
  offerings,
  onUpdateAction,
  onCommentAction,
  onLogWalkinAction,
  onUpdateAdminFieldsAction,
  onUploadFile,
}: {
  initialRequests: RequestWithRelations[]
  initialEvents: ServiceRequestEvent[]
  offerings: Offering[]
  onUpdateAction: (payload: UpdatePayload) => Promise<{ success: boolean; message?: string }>
  onCommentAction: (requestId: string, message: string) => Promise<{ success: boolean; message?: string }>
  onLogWalkinAction: (payload: WalkinPayload) => Promise<{ success: boolean; message?: string; request?: ServiceRequest }>
  onUpdateAdminFieldsAction: (requestId: string, patch: Record<string, unknown>) => Promise<{ success: boolean; message?: string; request?: ServiceRequest }>
  onUploadFile: (file: File) => Promise<UploadedFile>
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [events, setEvents] = useState(initialEvents)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [walkinOpen, setWalkinOpen] = useState(false)

  const eventsByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestEvent[]>()
    for (const event of events) {
      const list = map.get(event.request_id) ?? []
      list.push(event)
      map.set(event.request_id, list)
    }
    return map
  }, [events])

  const columns = useMemo(() => {
    const closed = requests.filter(r => CLOSED_STATUSES.includes(r.status))
    return [
      ...BOARD_COLUMNS.map(status => ({ status, items: requests.filter(r => r.status === status) })),
      ...(closed.length > 0 ? [{ status: 'closed' as const, items: closed }] : []),
    ]
  }, [requests])

  const selected = requests.find(r => r.id === selectedId) ?? null

  function patchRequest(id: string, patch: Partial<RequestWithRelations>) {
    setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function appendLocalEvent(event: ServiceRequestEvent) {
    setEvents(prev => [...prev, event])
  }

  function handleWalkinCreated(request: ServiceRequest, offering: Offering) {
    setRequests(prev => [
      { ...request, offerings: { name: offering.name, metadata_schema: offering.metadata_schema }, customer: null } as RequestWithRelations,
      ...prev,
    ])
    setEvents(prev => [
      ...prev,
      {
        id: Date.now(),
        request_id: request.id,
        actor_id: null,
        actor_role: 'business',
        event_type: 'submitted',
        message: `Logged in person for ${request.walk_in_name}`,
        metadata: {},
        created_at: new Date().toISOString(),
      },
    ])
  }

  const walkinDialog = (
    <LogWalkinRequestDialog
      open={walkinOpen}
      onOpenChange={setWalkinOpen}
      offerings={offerings}
      onSubmit={onLogWalkinAction}
      onUploadFile={onUploadFile}
      onCreated={handleWalkinCreated}
    />
  )

  const walkinButton = (
    <Button variant="outline" size="sm" onClick={() => setWalkinOpen(true)}>
      <UserPlus className="size-3.5" /> Log walk-in request
    </Button>
  )

  if (requests.length === 0) {
    return (
      <>
        <div className="mb-4 flex justify-end">{walkinButton}</div>
        <Card className="flex flex-col items-center gap-2 border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No requests yet — they&apos;ll show up here the moment a customer submits one, or log one yourself for a walk-in.</p>
        </Card>
        {walkinDialog}
      </>
    )
  }

  return (
    <>
      <div className="mb-4 flex justify-end">{walkinButton}</div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {columns.map(col => (
          <div key={col.status} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-foreground">
                {col.status === 'closed' ? 'Closed' : SERVICE_REQUEST_STATUS_LABELS[col.status]}
              </h3>
              <span className="label-mono text-muted-foreground">{col.items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {col.items.map(request => (
                <Card
                  key={request.id}
                  className="cursor-pointer space-y-1.5 p-3 transition-colors hover:border-primary/40"
                  onClick={() => setSelectedId(request.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{request.offerings?.name ?? 'Request'}</p>
                    {!request.customer_id && (
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Store className="size-2.5" /> Walk-in
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <User className="size-3" /> {customerDisplayName(request)}
                  </p>
                  {request.location_address && (
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <MapPinned className="size-3 shrink-0" /> {request.location_address}
                    </p>
                  )}
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="size-3" /> {new Date(request.created_at).toLocaleDateString()}
                  </p>
                  {request.quoted_price != null && (
                    <p className="font-mono text-xs font-bold text-foreground">₱{Number(request.quoted_price).toFixed(2)}</p>
                  )}
                </Card>
              ))}
              {col.items.length === 0 && <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Empty</p>}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <RequestDrawer
              key={selected.id}
              request={selected}
              events={eventsByRequest.get(selected.id) ?? []}
              onUpdateAction={onUpdateAction}
              onCommentAction={onCommentAction}
              onUpdateAdminFieldsAction={onUpdateAdminFieldsAction}
              onUploadFile={onUploadFile}
              onPatch={patch => patchRequest(selected.id, patch)}
              onEvent={appendLocalEvent}
            />
          )}
        </SheetContent>
      </Sheet>
      {walkinDialog}
    </>
  )
}

function RequestDrawer({
  request,
  events,
  onUpdateAction,
  onCommentAction,
  onUpdateAdminFieldsAction,
  onUploadFile,
  onPatch,
  onEvent,
}: {
  request: RequestWithRelations
  events: ServiceRequestEvent[]
  onUpdateAction: (payload: UpdatePayload) => Promise<{ success: boolean; message?: string }>
  onCommentAction: (requestId: string, message: string) => Promise<{ success: boolean; message?: string }>
  onUpdateAdminFieldsAction: (requestId: string, patch: Record<string, unknown>) => Promise<{ success: boolean; message?: string; request?: ServiceRequest }>
  onUploadFile: (file: File) => Promise<UploadedFile>
  onPatch: (patch: Partial<RequestWithRelations>) => void
  onEvent: (event: ServiceRequestEvent) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [nextStatus, setNextStatus] = useState<ServiceRequestStatus | ''>('')
  const [quote, setQuote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const options = nextStatuses(request.status)

  function applyUpdate(payload: Omit<UpdatePayload, 'requestId'>, successMessage: string, localPatch: Partial<RequestWithRelations>) {
    startTransition(async () => {
      const result = await onUpdateAction({ requestId: request.id, ...payload })
      if (!result.success) {
        toast.error(result.message ?? 'Update failed')
        return
      }
      onPatch(localPatch)
      onEvent({
        id: Date.now(),
        request_id: request.id,
        actor_id: null,
        actor_role: 'business',
        event_type: payload.status ? 'status_change' : 'quote_sent',
        message: payload.message ?? null,
        metadata: { status: payload.status, quoted_price: payload.quotedPrice },
        created_at: new Date().toISOString(),
      })
      toast.success(successMessage)
    })
  }

  function handleStatusChange() {
    if (!nextStatus) return
    if (nextStatus === 'rejected' && !rejectionReason.trim()) {
      toast.error('A reason is required to reject a request.')
      return
    }
    applyUpdate(
      { status: nextStatus, rejectionReason: nextStatus === 'rejected' ? rejectionReason.trim() : undefined },
      `Moved to ${SERVICE_REQUEST_STATUS_LABELS[nextStatus]}`,
      { status: nextStatus, rejection_reason: nextStatus === 'rejected' ? rejectionReason.trim() : request.rejection_reason }
    )
    setNextStatus('')
  }

  function handleSendQuote() {
    const value = Number(quote)
    if (!quote || Number.isNaN(value)) {
      toast.error('Enter a valid amount')
      return
    }
    applyUpdate({ quotedPrice: value, message: `Quoted ₱${value.toFixed(2)}` }, 'Quote sent', { quoted_price: value })
    setQuote('')
  }

  async function handleComment(message: string) {
    const result = await onCommentAction(request.id, message)
    if (result.success) {
      onEvent({
        id: Date.now(),
        request_id: request.id,
        actor_id: null,
        actor_role: 'business',
        event_type: 'comment',
        message,
        metadata: {},
        created_at: new Date().toISOString(),
      })
    }
    return result
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{request.offerings?.name ?? 'Request'}</SheetTitle>
        <SheetDescription>
          {customerDisplayName(request)}
          {!request.customer_id && ' (walk-in)'}
          {request.walk_in_phone && ` · ${request.walk_in_phone}`}
          {' · submitted '}{new Date(request.created_at).toLocaleString()}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        <div className="flex items-center gap-2">
          <ServiceRequestStatusBadge status={request.status} />
          {!request.customer_id && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Store className="size-2.5" /> Logged in person
            </Badge>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          {request.location_address && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                <MapPinned className="size-3.5 shrink-0 text-primary" /> {request.location_address}
                {request.location_lat != null && request.location_lng != null && (
                  <DeliveryNavigateButton
                    lat={request.location_lat}
                    lng={request.location_lng}
                    customerLabel={customerDisplayName(request)}
                    address={request.location_address}
                    className="ml-1"
                  />
                )}
              </p>
            </div>
          )}
          {(request.offerings?.metadata_schema ?? []).filter(field => !field.admin_only).map(field => (
            <FieldRenderer key={field.key} field={field} value={request.form_data?.[field.key]} readOnly />
          ))}
          {request.customer_notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="whitespace-pre-line text-sm text-foreground">{request.customer_notes}</p>
            </div>
          )}
          {request.owner_notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Internal notes</p>
              <p className="whitespace-pre-line text-sm text-foreground">{request.owner_notes}</p>
            </div>
          )}
        </div>

        {(request.offerings?.metadata_schema ?? []).some(field => field.admin_only) && (
          <AdminFieldsEditor
            requestId={request.id}
            fields={(request.offerings?.metadata_schema ?? []).filter(field => field.admin_only)}
            values={request.form_data ?? {}}
            onSave={onUpdateAdminFieldsAction}
            onUploadFile={onUploadFile}
            onSaved={patch => onPatch({ form_data: { ...request.form_data, ...patch } })}
          />
        )}

        {options.length > 0 && (
          <div className="space-y-1.5">
            <Label>Move to</Label>
            <div className="flex gap-2">
              <Select value={nextStatus} onValueChange={v => setNextStatus(v as ServiceRequestStatus)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a status…" /></SelectTrigger>
                <SelectContent>
                  {options.map(s => <SelectItem key={s} value={s}>{SERVICE_REQUEST_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleStatusChange} disabled={isPending || !nextStatus}>
                {isPending ? <Loader2 className="animate-spin" /> : 'Update'}
              </Button>
            </div>
            {nextStatus === 'rejected' && (
              <Textarea placeholder="Reason for declining (shown to the customer)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2} />
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Send a quote</Label>
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" placeholder="₱0.00" value={quote} onChange={e => setQuote(e.target.value)} />
            <Button variant="outline" onClick={handleSendQuote} disabled={isPending || !quote}>Send</Button>
          </div>
          <p className="text-xs text-muted-foreground">Cash still changes hands off-platform — this just records what was agreed.</p>
        </div>

        <div className="border-t pt-4">
          <Label className="mb-2 block">Messages</Label>
          <RequestTimeline events={events} viewerRole="business" onComment={handleComment} placeholder="Message the customer…" />
        </div>
      </div>
    </>
  )
}

// The offering's admin_only fields — editable here and only here (the
// customer's own submission form never rendered or asked for these, see
// DynamicOfferingRequestForm). Once saved, the customer *can* see the value
// on their own tracking page (under "Details from {shop}") — admin_only
// means the shop fills it in, not that it's secret. Saving merges the patch
// into form_data (see update_request_admin_fields()) without touching
// whatever the customer themselves submitted, and deliberately doesn't log
// a timeline event — the value already surfaces plainly in its own section,
// so logging it too would just be a second, noisier copy of the same update.
function AdminFieldsEditor({
  requestId,
  fields,
  values,
  onSave,
  onUploadFile,
  onSaved,
}: {
  requestId: string
  fields: OfferingField[]
  values: Record<string, unknown>
  onSave: (requestId: string, patch: Record<string, unknown>) => Promise<{ success: boolean; message?: string; request?: ServiceRequest }>
  onUploadFile: (file: File) => Promise<UploadedFile>
  onSaved: (patch: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(values)
  const [saving, setSaving] = useState(false)

  function handleSave() {
    setSaving(true)
    const patch = Object.fromEntries(fields.map(f => [f.key, draft[f.key] ?? null]))
    onSave(requestId, patch)
      .then(result => {
        if (!result.success) {
          toast.error(result.message ?? 'Failed to save')
          return
        }
        onSaved(patch)
        toast.success('Internal fields saved')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <p className="label-mono flex items-center gap-1.5 text-primary"><UserPlus className="size-3" /> Filled in by you — the customer sees this too</p>
      {fields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={draft[field.key]}
          onChange={v => setDraft(prev => ({ ...prev, [field.key]: v }))}
          onUploadFile={onUploadFile}
        />
      ))}
      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save internal fields'}
      </Button>
    </div>
  )
}
