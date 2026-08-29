'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import FieldRenderer from '@/components/offerings/FieldRenderer'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, MapPin, Loader2 } from 'lucide-react'
import { validateFormData, FULFILLMENT_METHOD_LABELS } from '@/lib/offerings/field-schema'
import type { Offering, ServiceRequest, RequestFulfillmentMethod, UploadedFile } from '@/lib/types/marketplace'

type LocationValue = { address: string; lat: number; lng: number }

const EMPTY_STATE = {
  offeringId: '',
  formData: {} as Record<string, unknown>,
  customerName: '',
  customerPhone: '',
  location: null as LocationValue | null,
  fulfillmentMethod: '' as RequestFulfillmentMethod | '',
  customerNotes: '',
  ownerNotes: '',
}

// The admin-side counterpart to DynamicOfferingRequestForm: same
// offering.metadata_schema, same FieldRenderer, filled out by the business
// owner for a walk-in customer who came into the shop in person and doesn't
// use the app. No account is created — log_walkin_service_request() stores
// a name/phone instead of a customer_id (see database_schema.sql).
export default function LogWalkinRequestDialog({
  open,
  onOpenChange,
  offerings,
  onSubmit,
  onUploadFile,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offerings: Offering[]
  onSubmit: (payload: {
    offeringId: number
    formData: Record<string, unknown>
    customerName: string
    customerPhone: string | null
    location: LocationValue | null
    fulfillmentMethod: RequestFulfillmentMethod | null
    customerNotes: string | null
    ownerNotes: string | null
  }) => Promise<{ success: boolean; message?: string; request?: ServiceRequest }>
  onUploadFile: (file: File) => Promise<UploadedFile>
  onCreated: (request: ServiceRequest, offering: Offering) => void
}) {
  const [state, setState] = useState(EMPTY_STATE)
  const [mapOpen, setMapOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedOffering = offerings.find(o => String(o.id) === state.offeringId) ?? null

  function reset() {
    setState(EMPTY_STATE)
    setErrors({})
    setError(null)
  }

  function patch(next: Partial<typeof state>) {
    setState(prev => ({ ...prev, ...next }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedOffering) {
      setError('Choose which service this is for.')
      return
    }
    if (!state.customerName.trim()) {
      setError('The customer’s name is required.')
      return
    }
    const validation = validateFormData(selectedOffering.metadata_schema, state.formData)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setSubmitting(true)
    try {
      const result = await onSubmit({
        offeringId: selectedOffering.id,
        formData: state.formData,
        customerName: state.customerName.trim(),
        customerPhone: state.customerPhone.trim() || null,
        location: state.location,
        fulfillmentMethod: state.fulfillmentMethod || null,
        customerNotes: state.customerNotes.trim() || null,
        ownerNotes: state.ownerNotes.trim() || null,
      })
      if (!result.success || !result.request) {
        setError(result.message ?? 'Failed to log this request.')
        return
      }
      onCreated(result.request, selectedOffering)
      toast.success('Request logged')
      reset()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a walk-in request</DialogTitle>
          <DialogDescription>For a customer standing in front of you who doesn&apos;t use the app — you fill out the form instead.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Select value={state.offeringId} onValueChange={v => patch({ offeringId: String(v ?? ''), formData: {} })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose which offering…" /></SelectTrigger>
              <SelectContent>
                {offerings.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {offerings.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No custom offerings yet — create one on the <a href="/sell/offerings" className="text-primary hover:underline">Offerings</a> page first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name">Customer name <span className="text-destructive">*</span></Label>
              <Input id="wi-name" value={state.customerName} onChange={e => patch({ customerName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-phone">Phone</Label>
              <Input id="wi-phone" value={state.customerPhone} onChange={e => patch({ customerPhone: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          {selectedOffering && (
            <>
              {selectedOffering.metadata_schema.map(field => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={state.formData[field.key]}
                  onChange={v => patch({ formData: { ...state.formData, [field.key]: v } })}
                  error={errors[field.key]}
                  onUploadFile={onUploadFile}
                />
              ))}

              <div className="space-y-1.5">
                <Label>Location</Label>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setMapOpen(true)}>
                  <MapPin className="size-4" />
                  {state.location?.address || 'Drop a pin (optional)'}
                </Button>
                <p className="text-xs text-muted-foreground">Optional — the customer&apos;s right here, so only set this if the job needs a specific location.</p>
                <MapLocationPicker
                  open={mapOpen}
                  onOpenChange={setMapOpen}
                  initialLat={state.location?.lat}
                  initialLng={state.location?.lng}
                  title="Customer location"
                  description="Optional — only if this job needs one."
                  onConfirm={result => patch({ location: result })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>How should this be handled?</Label>
                <Select value={state.fulfillmentMethod} onValueChange={v => patch({ fulfillmentMethod: v as RequestFulfillmentMethod })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FULFILLMENT_METHOD_LABELS) as [RequestFulfillmentMethod, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wi-customer-notes">Notes from the customer</Label>
                <Textarea id="wi-customer-notes" rows={2} value={state.customerNotes} onChange={e => patch({ customerNotes: e.target.value })} placeholder="Optional" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wi-owner-notes">Internal notes</Label>
                <Textarea id="wi-owner-notes" rows={2} value={state.ownerNotes} onChange={e => patch({ ownerNotes: e.target.value })} placeholder="Not shown to the customer" />
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !selectedOffering}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? 'Logging…' : 'Log request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
