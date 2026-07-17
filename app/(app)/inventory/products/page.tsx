import { createClient, requireUserRole } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import ProductsClient from '@/components/inventory/ProductsClient'

export const revalidate = 0

export default async function ProductsPage() {
  await requireUserRole(['admin'])
  const supabase = await createClient()

  // Concurrently load all models to avoid network waterfalls
  const [
    { data: products, error: pErr },
    { data: categories, error: cErr },
    { data: ingredients, error: iErr }
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name), recipes(ingredient_id, quantity_used)')
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('id, name')
      .order('name'),
    supabase
      .from('ingredients')
      .select('id, name, unit_type, cost_per_unit, current_stock') // 👈 Added current_stock
      .order('name')
  ])

  if (pErr || cErr || iErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to load products engine: {pErr?.message ?? cErr?.message ?? iErr?.message}
      </div>
    )
  }

  // SERVER ACTION: Handles saving both standalone items and recipe ingredients
  async function saveProductAction(payload: any, recipeItems: { ingredient_id: number; quantity_used: number }[]) {
    'use server'
    const serverSupabase = await createClient()

    const itemPayload = {
      name: payload.name,
      category_id: payload.category_id,
      sku: payload.sku,
      cost_price: payload.cost_price,
      selling_price: payload.selling_price,
      stock: payload.stock // Will be saved as 0 for recipe items
    }

    if (payload.id) {
      const { error: pUpdateErr } = await serverSupabase
        .from('products')
        .update(itemPayload)
        .eq('id', payload.id)

      if (pUpdateErr) throw new Error(pUpdateErr.message)

      await serverSupabase.from('recipes').delete().eq('product_id', payload.id)
      
      if (recipeItems.length > 0) {
        const insertRows = recipeItems.map(item => ({
          product_id: payload.id,
          ingredient_id: item.ingredient_id,
          quantity_used: item.quantity_used
        }))
        const { error: rInsertErr } = await serverSupabase.from('recipes').insert(insertRows)
        if (rInsertErr) throw new Error(rInsertErr.message)
      }
    } else {
      const { data: newProd, error: pInsertErr } = await serverSupabase
        .from('products')
        .insert([itemPayload])
        .select()
        .single()

      if (pInsertErr) throw new Error(pInsertErr.message)

      if (recipeItems.length > 0 && newProd) {
        const insertRows = recipeItems.map(item => ({
          product_id: newProd.id,
          ingredient_id: item.ingredient_id,
          quantity_used: item.quantity_used
        }))
        const { error: rInsertErr } = await serverSupabase.from('recipes').insert(insertRows)
        if (rInsertErr) throw new Error(rInsertErr.message)
      }
    }

    revalidatePath('/products')
  }

  async function deleteProductAction(id: number) {
    'use server'
    const serverSupabase = await createClient()
    const { error } = await serverSupabase.from('products').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/products')
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