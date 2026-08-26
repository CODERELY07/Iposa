import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import ProductsClient from '@/components/business/ProductsClient'
import { saveProductAction, deleteProductAction } from './actions'

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
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to load products: {error.message}
      </div>
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
