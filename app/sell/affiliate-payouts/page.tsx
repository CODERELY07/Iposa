import { requireApprovedBusiness, createClient } from '@/lib/supabase/server'
import BusinessPayoutsClient from '@/components/business/BusinessPayoutsClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { AffiliatePayout } from '@/lib/types/marketplace'

export const revalidate = 0

// Every sale here is cash (see affiliate_payouts in database_schema.sql) —
// there's no pooled platform float to pay an affiliate out of, only whatever
// cash THIS shop took in on the sales it owes a commission on. So unlike a
// typical marketplace, settling an affiliate payout isn't a platform admin's
// job: it's this business's own, done in person, and this page is where that
// happens.
export default async function SellAffiliatePayoutsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { data: payouts, error } = await supabase
    .from('affiliate_payouts')
    .select('id, affiliate_id, business_id, amount, status, requested_at, paid_at, affiliates(full_name, code, payout_details)')
    .eq('business_id', business.id)
    .order('requested_at', { ascending: true })

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Affiliate Payouts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cash you owe affiliates for sales they referred to your shop. Pay them in person, then mark each request paid here.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load payouts: {error.message}</AlertDescription>
        </Alert>
      ) : (
        <BusinessPayoutsClient payouts={(payouts ?? []) as unknown as AffiliatePayout[]} />
      )}
    </div>
  )
}
