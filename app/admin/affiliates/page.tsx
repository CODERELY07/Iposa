import { createClient } from '@/lib/supabase/server'
import AffiliateReviewClient from '@/components/marketplace/AffiliateReviewClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function AdminAffiliatesPage() {
  const supabase = await createClient()
  const { data: affiliates, error } = await supabase
    .from('affiliates')
    .select('*')
    .order('status', { ascending: true }) // pending sorts first alphabetically
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Affiliate Applications</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Review, approve, or reject affiliate program applications.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load affiliates: {error.message}</AlertDescription>
        </Alert>
      ) : (
        <AffiliateReviewClient affiliates={affiliates ?? []} />
      )}
    </div>
  )
}
