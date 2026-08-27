import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import PosClient from '@/components/business/PosClient'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellPosPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const [
    { data: products, error: pErr },
    { data: categories, error: cErr },
    { data: ingredients, error: iErr }
  ] = await Promise.all([
    // Note: not filtered by is_active — that flag only controls public
    // marketplace listing. In-store POS sells the full catalog regardless.
    supabase
      .from('store_products')
      .select('*, categories(name), recipes(ingredient_id, quantity_used)')
      .eq('business_id', business.id)
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name')
      .order('name'),
    supabase
      .from('ingredients')
      .select('id, name, current_stock')
      .eq('business_id', business.id)
  ])

  if (pErr || cErr || iErr) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertTitle>Failed to initialize POS engine</AlertTitle>
        <AlertDescription>{pErr?.message ?? cErr?.message ?? iErr?.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <PosClient
      initialProducts={products ?? []}
      categories={categories ?? []}
      ingredients={ingredients ?? []}
    />
  )
}
