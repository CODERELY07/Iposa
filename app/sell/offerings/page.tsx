import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import OfferingsClient from '@/components/business/OfferingsClient'
import { saveOfferingAction, deleteOfferingAction } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellOfferingsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const [{ data: offerings, error }, { data: categories }] = await Promise.all([
    supabase
      .from('offerings')
      .select('*, categories(name)')
      .eq('business_id', business.id)
      .order('requires_pos', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('categories').select('id, name, slug, created_at').order('name'),
  ])

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to load offerings: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <OfferingsClient
      initialOfferings={offerings ?? []}
      categories={categories ?? []}
      onSaveAction={saveOfferingAction}
      onDeleteAction={deleteOfferingAction}
    />
  )
}
