export type BusinessStatus = 'pending' | 'approved' | 'rejected'

export type Business = {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  status: BusinessStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type StoreCategory = {
  id: number
  name: string
  slug: string | null
  created_at: string
}

export type StoreProduct = {
  id: number
  business_id: string
  category_id: number | null
  name: string
  slug: string
  sku: string | null
  description: string | null
  image_url: string | null
  cost_price: number
  price: number
  stock: number
  is_active: boolean
  created_at: string
  updated_at: string
  categories?: { name: string } | null
  recipes?: RecipeItem[]
}

export type Ingredient = {
  id: number
  business_id: string
  name: string
  sku: string | null
  cost_per_unit: number
  unit_type: string
  current_stock: number
  min_stock_alert: number
  created_at: string
}

export type RecipeItem = {
  ingredient_id: number
  quantity_used: number
}

// Row shape returned by the public.marketplace_products view — pre-joined
// with the owning (approved) business and category for the storefront feed.
export type MarketplaceProduct = {
  id: number
  name: string
  slug: string
  description: string | null
  image_url: string | null
  price: number
  stock: number
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  business_id: string
  business_name: string
  business_slug: string
  business_logo_url: string | null
  created_at: string
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'

export type StoreOrder = {
  id: string
  business_id: string
  customer_id: string
  status: OrderStatus
  subtotal: number
  total: number
  shipping_name: string | null
  shipping_phone: string | null
  shipping_address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type StoreOrderItem = {
  id: number
  order_id: string
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export type CartItem = {
  productId: number
  name: string
  price: number
  imageUrl: string | null
  businessId: string
  businessName: string
  quantity: number
}
