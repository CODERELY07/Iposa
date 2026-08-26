import { createClient } from '@/lib/supabase/server'
import PayoutReviewClient from '@/components/marketplace/PayoutReviewClient'
import type { AffiliatePayout } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  const { data: payouts, error } = await supabase
    .from('affiliate_payouts')
    .select('id, amount, status, requested_at, paid_at, affiliates(full_name, code)')
    .eq('status', 'requested')
    .order('requested_at', { ascending: true })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Affiliate Payouts</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Review and settle pending payout requests.</p>
      </div>

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load payouts: {error.message}
        </div>
      ) : (
        <PayoutReviewClient payouts={(payouts ?? []) as unknown as AffiliatePayout[]} />
      )}
    </div>
  )
}
