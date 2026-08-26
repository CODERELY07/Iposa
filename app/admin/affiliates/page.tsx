import { createClient } from '@/lib/supabase/server'
import AffiliateReviewClient from '@/components/marketplace/AffiliateReviewClient'

export const revalidate = 0

export default async function AdminAffiliatesPage() {
  const supabase = await createClient()
  const { data: affiliates, error } = await supabase
    .from('affiliates')
    .select('*')
    .order('status', { ascending: true }) // pending sorts first alphabetically
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Affiliate Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Review, approve, or reject affiliate program applications.</p>
      </div>

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load affiliates: {error.message}
        </div>
      ) : (
        <AffiliateReviewClient affiliates={affiliates ?? []} />
      )}
    </div>
  )
}
