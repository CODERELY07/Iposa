import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ServiceRequestStatusBadge } from '@/components/marketplace/StatusBadge'
import { ChevronRight, PackageSearch, Sparkles } from 'lucide-react'
import type { ServiceRequest, ServiceRequestStatus } from '@/lib/types/marketplace'

export const revalidate = 0

type RequestRow = ServiceRequest & {
  offerings: { name: string } | null
  businesses: { name: string; slug: string } | null
}

// The services/repairs/loans/bookings a customer has requested — kept off
// /orders entirely, since these never go through a cart and don't behave
// like a POS order (no items, no total, a form and a conversation instead).
export default async function MyServicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: requests, error } = await supabase
    .from('service_requests')
    .select('*, offerings(name), businesses(name, slug)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-normal tracking-tight text-foreground">
          <Sparkles className="size-5 text-primary" /> My services
        </h1>
        <Link href="/orders" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <PackageSearch className="size-3.5" /> Looking for a cart order?
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load your services: {error.message}
        </div>
      )}

      {!error && (requests ?? []).length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <Sparkles className="size-6 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">You haven&apos;t requested any services yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {((requests ?? []) as RequestRow[]).map(request => (
          <Link key={request.id} href={`/services/${request.id}`}>
            <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{request.offerings?.name ?? 'Request'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {request.businesses?.name ?? 'Shop'} · {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ServiceRequestStatusBadge status={request.status as ServiceRequestStatus} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
