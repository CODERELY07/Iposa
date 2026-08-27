'use server'

import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import type { RecipeItem } from '@/lib/types/marketplace'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

type ProductPayload = {
  id: number | null
  name: string
  category_id: number | null
  sku: string | null
  description: string | null
  image_url: string | null
  cost_price: number
  price: number
  stock: number
  is_active: boolean
}

export async function saveProductAction(payload: ProductPayload, recipeItems: RecipeItem[]) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  // Whether this row tracks a finite stock count at all is derived from the
  // business's own type, never trusted from the client — a service (see
  // lib/business/type-meta.ts) is always available regardless of `stock`,
  // which is meaningless for it and just stored as 0.
  const tracksStock = getBusinessTypeMeta(business.business_type).tracksStock

  const itemPayload = {
    name: payload.name,
    category_id: payload.category_id,
    sku: payload.sku,
    description: payload.description,
    image_url: payload.image_url,
    cost_price: payload.cost_price,
    price: payload.price,
    stock: tracksStock ? payload.stock : 0,
    track_stock: tracksStock,
    is_active: payload.is_active,
  }

  let productId = payload.id

  if (productId) {
    const { error } = await supabase
      .from('store_products')
      .update(itemPayload)
      .eq('id', productId)
      .eq('business_id', business.id)

    if (error) throw new Error(error.message)

    await supabase.from('recipes').delete().eq('product_id', productId)
  } else {
    const { data: newProduct, error } = await supabase
      .from('store_products')
      .insert({
        ...itemPayload,
        business_id: business.id,
        slug: `${slugify(payload.name)}-${Math.random().toString(36).slice(2, 7)}`,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    productId = newProduct.id
  }

  if (recipeItems.length > 0 && productId) {
    const rows = recipeItems.map(item => ({
      product_id: productId,
      ingredient_id: item.ingredient_id,
      quantity_used: item.quantity_used,
    }))
    const { error: recipeError } = await supabase.from('recipes').insert(rows)
    if (recipeError) throw new Error(recipeError.message)
  }

  revalidatePath('/sell/products')
  revalidatePath('/')
  revalidatePath(`/shop/${business.slug}`)
}

export async function deleteProductAction(id: number) {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { error } = await supabase.from('store_products').delete().eq('id', id).eq('business_id', business.id)
  if (error) throw new Error(error.message)

  revalidatePath('/sell/products')
  revalidatePath('/')
}
