import { createClient } from '@/lib/supabase/server'
import PosClient from '@/components/inventory/PosClient'

export const revalidate = 0

export default async function PosPage() {
  const supabase = await createClient()

  // Concurrently loading raw models avoiding consecutive network waterfalls
  const [
    { data: products, error: pErr }, 
    { data: categories, error: cErr },
    { data: ingredients, error: iErr }
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name), recipes(ingredient_id, quantity_used)')
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name')
      .order('name'),
    supabase
      .from('ingredients')
      .select('id, name, current_stock')
  ])

  if (pErr || cErr || iErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to initialize POS engine: {pErr?.message ?? cErr?.message ?? iErr?.message}
      </div>
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