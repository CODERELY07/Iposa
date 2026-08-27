import { createClient } from '@/lib/supabase/server'
import BusinessReviewClient from '@/components/marketplace/BusinessReviewClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function AdminBusinessesPage() {
  const supabase = await createClient()
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .order('status', { ascending: true }) // pending sorts first alphabetically
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Business Applications</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Review, approve, or reject storefront requests.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load businesses: {error.message}</AlertDescription>
        </Alert>
      ) : (
        <BusinessReviewClient businesses={businesses ?? []} />
      )}
    </div>
  )
}
