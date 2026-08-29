import { Badge } from '@/components/ui/badge'
import { Store, Truck } from 'lucide-react'
import type {
  OrderStatus,
  BusinessStatus,
  AffiliateStatus,
  AffiliateCommissionStatus,
  AffiliatePayoutStatus,
  FulfillmentMethod,
  ServiceRequestStatus,
} from '@/lib/types/marketplace'
import { SERVICE_REQUEST_STATUS_LABELS } from '@/lib/offerings/field-schema'

// One color per semantic meaning, reused across every status pill in the
// app: amber = waiting, sky/violet = in progress, emerald = good outcome,
// red = bad outcome.
const WAITING = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400'
const IN_PROGRESS = 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400'
const SHIPPED = 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400'
const GOOD = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
const BAD = 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <Badge variant="outline" className={`font-mono uppercase tracking-wider ${className}`}>
      {label}
    </Badge>
  )
}

const ORDER_STYLES: Record<OrderStatus, string> = {
  pending: WAITING,
  paid: IN_PROGRESS,
  processing: IN_PROGRESS,
  shipped: SHIPPED,
  awaiting_confirmation: WAITING,
  completed: GOOD,
  disputed: BAD,
  cancelled: BAD,
}
// 'awaiting_confirmation' reads as "out for delivery" everywhere it's shown —
// the enum value stays for continuity with existing rows/queries, but the
// business no longer separately "ships" then "marks done"; setting this
// status directly is both at once (see SECTION 11 in database_schema.sql).
const ORDER_LABELS: Partial<Record<OrderStatus, string>> = {
  awaiting_confirmation: 'out for delivery',
}
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusPill label={ORDER_LABELS[status] ?? status.replace(/_/g, ' ')} className={ORDER_STYLES[status]} />
}

const APPLICATION_STYLES: Record<BusinessStatus | AffiliateStatus, string> = {
  pending: WAITING,
  approved: GOOD,
  rejected: BAD,
}
export function ApplicationStatusBadge({ status }: { status: BusinessStatus | AffiliateStatus }) {
  return <StatusPill label={status} className={APPLICATION_STYLES[status]} />
}

const COMMISSION_STYLES: Record<AffiliateCommissionStatus, string> = {
  pending: WAITING,
  approved: GOOD,
  paid: IN_PROGRESS,
  void: BAD,
}
export function CommissionStatusBadge({ status }: { status: AffiliateCommissionStatus }) {
  return <StatusPill label={status} className={COMMISSION_STYLES[status]} />
}

const PAYOUT_STYLES: Record<AffiliatePayoutStatus, string> = {
  requested: WAITING,
  paid: GOOD,
  rejected: BAD,
}
export function PayoutStatusBadge({ status }: { status: AffiliatePayoutStatus }) {
  return <StatusPill label={status} className={PAYOUT_STYLES[status]} />
}

const SERVICE_REQUEST_STYLES: Record<ServiceRequestStatus, string> = {
  submitted: WAITING,
  in_review: IN_PROGRESS,
  accepted: IN_PROGRESS,
  in_progress: SHIPPED,
  awaiting_customer: WAITING,
  completed: GOOD,
  rejected: BAD,
  cancelled: BAD,
}
export function ServiceRequestStatusBadge({ status }: { status: ServiceRequestStatus }) {
  return <StatusPill label={SERVICE_REQUEST_STATUS_LABELS[status]} className={SERVICE_REQUEST_STYLES[status]} />
}

export function FulfillmentBadge({ method }: { method: FulfillmentMethod }) {
  const Icon = method === 'pickup' ? Store : Truck
  return (
    <Badge variant="outline" className="font-mono uppercase tracking-wider text-muted-foreground">
      <Icon /> {method}
    </Badge>
  )
}
