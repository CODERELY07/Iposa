export type BusinessStatus = 'pending' | 'approved' | 'rejected'

// Chosen once at registration (see RegisterBusinessForm) and drives which
// costing model the whole /sell dashboard uses for that business — see
// lib/business/type-meta.ts for what each type changes and why. 'services'
// covers any business that sells named services rather than physical stock
// (printing, repairs, salons...) — it replaced the earlier, narrower
// 'print_shop' value.
export type BusinessType = 'restaurant' | 'services' | 'retail'

export type Business = {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  status: BusinessStatus
  business_type: BusinessType
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
  // false for a service (see lib/business/type-meta.ts) — it's always
  // treated as available regardless of `stock`, which is unused in that case.
  track_stock: boolean
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
  track_stock: boolean
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  business_id: string
  business_name: string
  business_slug: string
  business_logo_url: string | null
  created_at: string
}

// 'awaiting_confirmation': the business claims the order is done; this alone
// never finalizes anything — it just opens a confirmation window for the
// customer. 'disputed': the customer rejected that claim, routed to
// super_admin. See request_order_completion() and friends in
// database_schema.sql SECTION 11 for the full state machine.
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'awaiting_confirmation'
  | 'completed'
  | 'disputed'
  | 'cancelled'

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
  awaiting_confirmation_at: string | null
  dispute_reason: string | null
  platform_fee_rate: number | null
  platform_fee_amount: number | null
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

export type AffiliateStatus = 'pending' | 'approved' | 'rejected'

export type Affiliate = {
  id: string
  user_id: string
  full_name: string
  code: string
  payout_method: string | null
  payout_details: string | null
  status: AffiliateStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type BusinessAffiliateSettings = {
  business_id: string
  enabled: boolean
  commission_rate: number
  updated_at: string
}

export type AffiliateCommissionStatus = 'pending' | 'approved' | 'void' | 'paid'

export type AffiliateCommission = {
  id: number
  affiliate_id: string
  order_id: string
  business_id: string
  // Subtotal of just the items that were added/bought through this
  // affiliate's link — not necessarily the whole order's total.
  referred_subtotal: number
  commission_rate: number
  commission_amount: number
  status: AffiliateCommissionStatus
  payout_id: string | null
  created_at: string
  updated_at: string
  businesses?: { name: string; slug: string } | null
}

export type AffiliatePayoutStatus = 'requested' | 'paid' | 'rejected'

export type AffiliatePayout = {
  id: string
  affiliate_id: string
  amount: number
  status: AffiliatePayoutStatus
  requested_at: string
  paid_at: string | null
  notes: string | null
  affiliates?: { full_name: string; code: string } | null
}

export type CartItem = {
  productId: number
  name: string
  price: number
  imageUrl: string | null
  businessId: string
  businessName: string
  quantity: number
  // Set only when this exact line item was added (or bought) from a
  // specific product's page while an affiliate's `?ref=` code was present
  // in that page's URL. Merely browsing a referred link earns nothing —
  // only committing to Add to Cart/Buy Now on that page does, so this is
  // stamped at the moment of that action, never persisted independently of it.
  refCode?: string | null
}
