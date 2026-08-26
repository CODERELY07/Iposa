import { createClient } from '@/lib/supabase/server'
import BusinessReviewClient from '@/components/marketplace/BusinessReviewClient'

export const revalidate = 0

export default async function AdminBusinessesPage() {
  const supabase = await createClient()
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .order('status', { ascending: true }) // pending sorts first alphabetically
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Business Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Review, approve, or reject storefront requests.</p>
      </div>

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load businesses: {error.message}
        </div>
      ) : (
        <BusinessReviewClient businesses={businesses ?? []} />
      )}
    </div>
  )
}
