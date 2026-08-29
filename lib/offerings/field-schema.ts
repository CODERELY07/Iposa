import type { OfferingField, OfferingFieldType, RequestFulfillmentMethod, ServiceRequestStatus } from '@/lib/types/marketplace'

// Shared between the customer's own request form and the owner's walk-in
// logging dialog — same question, asked from either side of the counter.
export const FULFILLMENT_METHOD_LABELS: Record<RequestFulfillmentMethod, string> = {
  pickup: 'I’ll pick it up',
  delivery: 'Deliver to me',
  on_site: 'Come to my location',
  remote: 'Handled remotely / online',
}

// The complete contract between offerings.metadata_schema and everything
// that reads it: the customer-facing form (FieldRenderer), the Offering
// Builder's field picker, and the admin drawer's read-only view. Adding a
// type here is the one case in this whole feature that needs a code
// change — every other new field just gets typed into the builder.
export const FIELD_TYPES: { value: OfferingFieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Short text', hint: 'A single line, e.g. a device model' },
  { value: 'textarea', label: 'Long text', hint: 'A few sentences, e.g. a description of the issue' },
  { value: 'number', label: 'Number', hint: 'A quantity or amount' },
  { value: 'select', label: 'Choice', hint: 'Pick one from a list you define' },
  { value: 'multiselect', label: 'Multiple choice', hint: 'Pick any number from a list you define' },
  { value: 'date', label: 'Date', hint: 'A calendar date, no time' },
  { value: 'datetime', label: 'Date & time', hint: 'e.g. a preferred drop-off or appointment time' },
  { value: 'file', label: 'File upload', hint: 'Photos or documents the customer attaches' },
  { value: 'address', label: 'Location', hint: 'A pin the customer drops on a map' },
]

export function slugifyFieldKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '') || 'field'
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

// Client-side mirror of validate_form_data() in database_schema.sql — a UX
// courtesy for instant feedback. The database function is the real gate;
// this only ever makes the form nicer to fill out, never the source of truth.
export function validateFormData(schema: OfferingField[], data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of schema) {
    const value = data[field.key]
    if (field.required && isEmpty(value)) {
      errors[field.key] = `${field.label} is required`
      continue
    }
    if (isEmpty(value)) continue

    if (field.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
      errors[field.key] = `${field.label} must be a number`
    } else if (field.type === 'number' && typeof value === 'number') {
      if (field.min !== undefined && value < field.min) errors[field.key] = `${field.label} must be at least ${field.min}`
      if (field.max !== undefined && value > field.max) errors[field.key] = `${field.label} must be at most ${field.max}`
    }
    if (field.type === 'select' && field.options && !field.options.includes(String(value))) {
      errors[field.key] = `${field.label} is not one of the allowed options`
    }
    if ((field.type === 'file' || field.type === 'multiselect') && !Array.isArray(value)) {
      errors[field.key] = `${field.label} must be a list`
    }
  }
  return errors
}

// Kanban column order + copy. Kept separate from the DB's CHECK constraint —
// this is display-only; update_service_request() in database_schema.sql is
// what actually enforces which of these a ticket may move between.
export const SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  'submitted',
  'in_review',
  'accepted',
  'in_progress',
  'awaiting_customer',
  'completed',
  'rejected',
  'cancelled',
]

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  accepted: 'Accepted',
  in_progress: 'In progress',
  awaiting_customer: 'Awaiting customer',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

// Mirrors the VALUES table inside update_service_request() — used to grey
// out illegal destinations in the status dropdown before the RPC ever runs.
const TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  submitted: ['in_review', 'rejected'],
  in_review: ['accepted', 'rejected'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_customer', 'completed', 'cancelled'],
  awaiting_customer: ['in_progress'],
  completed: [],
  rejected: [],
  cancelled: [],
}

export function nextStatuses(current: ServiceRequestStatus): ServiceRequestStatus[] {
  return TRANSITIONS[current] ?? []
}
