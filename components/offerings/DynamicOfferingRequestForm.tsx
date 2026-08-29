'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import FieldRenderer from '@/components/offerings/FieldRenderer'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2, SendHorizontal, AlertCircle, MapPin } from 'lucide-react'
import { validateFormData, FULFILLMENT_METHOD_LABELS } from '@/lib/offerings/field-schema'
import type { MarketplaceOffering, RequestFulfillmentMethod, UploadedFile } from '@/lib/types/marketplace'

type LocationValue = { address: string; lat: number; lng: number }

// Renders offering.metadata_schema via FieldRenderer, validates client-side
// for instant feedback (validate_form_data() in the database is the real
// gate), and submits through submit_service_request() — never through the
// cart, since this offering has requires_pos = false. No payment step exists
// anywhere in this flow by design: settlement happens off-platform, and the
// confirmation screen says so explicitly.
//
// The location picker below is NOT part of metadata_schema — unlike every
// other field, it's built in and required on every custom offering's
// request, regardless of what the offering's own schema defines (an owner
// can still add their own 'address' field for something schema-specific, but
// can't opt out of this one). submit_service_request() enforces the same
// requirement server-side.
export default function DynamicOfferingRequestForm({
  offering,
  onSubmit,
  onUploadFile,
}: {
  offering: MarketplaceOffering
  onSubmit: (payload: {
    offeringId: number
    formData: Record<string, unknown>
    location: LocationValue
    fulfillmentMethod: RequestFulfillmentMethod | null
    customerNotes: string | null
  }) => Promise<{ success: boolean; message?: string; requestId?: string }>
  onUploadFile: (file: File) => Promise<UploadedFile>
}) {
  const router = useRouter()
  // admin_only fields never reach the customer at all — not rendered, not
  // validated, not submitted. The owner fills those in later from the
  // Kanban drawer (see update_request_admin_fields() in database_schema.sql).
  const customerFields = offering.metadata_schema.filter(f => !f.admin_only)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<RequestFulfillmentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [locationError, setLocationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validation = validateFormData(customerFields, formData)
    setErrors(validation)

    if (!location) {
      setLocationError('Confirm a location on the map before sending this request.')
    } else {
      setLocationError(null)
    }

    if (Object.keys(validation).length > 0 || !location) {
      return
    }

    setSubmitting(true)
    try {
      const result = await onSubmit({
        offeringId: offering.id,
        formData,
        location,
        fulfillmentMethod: fulfillmentMethod || null,
        customerNotes: notes.trim() || null,
      })
      if (!result.success) {
        setSubmitError(result.message ?? 'Something went wrong. Please try again.')
        return
      }
      setDone(result.requestId ?? null)
      toast.success('Request sent')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
        <AlertDescription className="text-emerald-800 dark:text-emerald-300">
          <p className="font-medium text-foreground">Request sent to {offering.business_name}.</p>
          <p className="mt-1">
            No payment is due now — they&apos;ll review it and follow up to arrange pricing and{' '}
            {offering.requires_pos ? 'checkout' : 'pickup or delivery'}.
          </p>
          <Button className="mt-3" onClick={() => router.push(`/services/${done}`)}>
            Track this request
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {customerFields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={formData[field.key]}
          onChange={v => setFormData(prev => ({ ...prev, [field.key]: v }))}
          error={errors[field.key]}
          onUploadFile={onUploadFile}
        />
      ))}

      <div className="space-y-1.5">
        <Label>
          Your location <span className="text-destructive">*</span>
        </Label>
        <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setMapOpen(true)}>
          <MapPin className="size-4" />
          {location?.address || 'Drop a pin on the map'}
        </Button>
        <p className="text-xs text-muted-foreground">So {offering.business_name} knows where this request is coming from.</p>
        {locationError && <p className="text-xs text-destructive">{locationError}</p>}
        <MapLocationPicker
          open={mapOpen}
          onOpenChange={setMapOpen}
          initialLat={location?.lat}
          initialLng={location?.lng}
          title="Confirm your location"
          description="Search or drag the pin to where this request is for."
          onConfirm={result => {
            setLocation(result)
            setLocationError(null)
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>How should this be handled?</Label>
        <Select value={fulfillmentMethod} onValueChange={v => setFulfillmentMethod(v as RequestFulfillmentMethod)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Optional — let the shop decide" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(FULFILLMENT_METHOD_LABELS) as [RequestFulfillmentMethod, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="request-notes">Anything else the shop should know?</Label>
        <Textarea id="request-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional" />
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        {submitting ? 'Sending…' : 'Send request'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">No payment is collected here — the shop will follow up directly.</p>
    </form>
  )
}
