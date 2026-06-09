import { createClient } from '@/lib/supabase/server'
import ProductsClient from '@/components/inventory/ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()

  const [{ data: products, error: pErr }, { data: categories, error: cErr }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name')
        .order('name'),
    ])

  if (pErr || cErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg">
        Failed to load products: {pErr?.message ?? cErr?.message}
      </div>
    )
  }

  return (
    <ProductsClient
      initialProducts={products ?? []}
      categories={categories ?? []}
    />
  )
}