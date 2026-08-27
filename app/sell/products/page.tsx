import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import ProductsClient from '@/components/business/ProductsClient'
import { saveProductAction, deleteProductAction } from './actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellProductsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const [{ data: products, error }, { data: categories }, { data: ingredients }] = await Promise.all([
    supabase
      .from('store_products')
      .select('*, categories(name), recipes(ingredient_id, quantity_used)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name, slug, created_at').order('name'),
    supabase.from('ingredients').select('*').eq('business_id', business.id).order('name'),
  ])

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to load products: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <ProductsClient
      initialProducts={products ?? []}
      categories={categories ?? []}
      ingredients={ingredients ?? []}
      onSaveAction={saveProductAction}
      onDeleteAction={deleteProductAction}
    />
  )
}
