import { createClient } from '@/lib/supabase/server'
import PayoutReviewClient from '@/components/marketplace/PayoutReviewClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { AffiliatePayout } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  const { data: payouts, error } = await supabase
    .from('affiliate_payouts')
    .select('id, amount, status, requested_at, paid_at, affiliates(full_name, code), businesses(name, slug)')
    .eq('status', 'requested')
    .order('requested_at', { ascending: true })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Affiliate Payouts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every commission is cash, paid in person by the shop that owes it — each shop now settles its own payouts
          from their own dashboard. This is an oversight view for disputes, not the everyday path.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load payouts: {error.message}</AlertDescription>
        </Alert>
      ) : (
        <PayoutReviewClient payouts={(payouts ?? []) as unknown as AffiliatePayout[]} />
      )}
    </div>
  )
}
