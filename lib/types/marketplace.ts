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
  // Set from Shop Settings — see MapLocationPicker. Optional; a pickup order
  // falls back to "the seller will reach out" copy when these aren't set.
  address: string | null
  location_lat: number | null
  location_lng: number | null
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

// A fixed operating bill (rent, utilities, staff, subscriptions) logged on
// the Expenses page. Anything with billing_period within the current
// calendar month is deducted automatically from Analytics' net profit.
export type OperatingExpense = {
  id: number
  business_id: string
  title: string
  description: string | null
  amount: number
  billing_period: string
  created_at: string
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
  // Powers the "browse by type" section on the marketplace home page — see
  // lib/business/type-meta.ts for what each value means.
  business_type: BusinessType
  created_at: string
}

// 'awaiting_confirmation': the business set this directly ("out for
// delivery"); this alone never finalizes anything — it just opens a
// confirmation window for the customer, and the business can't reverse it.
// 'disputed': the customer rejected that claim, or reported a 'cancelled'
// order they actually received — either way routed to super_admin. See
// confirm_order_completion() and friends in database_schema.sql SECTION 11
// (and SECTION 13 for the cancellation-report path) for the full state machine.
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'awaiting_confirmation'
  | 'completed'
  | 'disputed'
  | 'cancelled'

export type FulfillmentMethod = 'delivery' | 'pickup'

export type StoreOrder = {
  id: string
  business_id: string
  customer_id: string
  status: OrderStatus
  subtotal: number
  total: number
  shipping_name: string | null
  shipping_phone: string | null
  fulfillment_method: FulfillmentMethod
  shipping_address: string | null
  // Set from the pin the customer confirmed on the checkout map — see
  // MapLocationPicker. Required for 'delivery' orders (enforced by
  // place_order()); always null for 'pickup', which has no shipping address.
  shipping_lat: number | null
  shipping_lng: number | null
  notes: string | null
  awaiting_confirmation_at: string | null
  // Filled in by dispute_order_completion() or report_cancelled_order() —
  // the customer's own account of what went wrong, shown to super_admin
  // when resolving the dispute. disputed_from_cancellation tells the two
  // cases apart.
  dispute_reason: string | null
  disputed_from_cancellation: boolean
  // Required whenever a business cancels an order directly — shown to the
  // customer. Null for a super_admin force-refund.
  cancellation_reason: string | null
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
  // That same referred slice's profit (revenue minus item cost) — what
  // commission_rate is actually applied against, not referred_subtotal.
  referred_profit: number
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
  // Which shop's cash this payout is owed from — see database_schema.sql
  // (affiliate_payouts): every sale here is cash, so a payout is always
  // scoped to one business, never lumped across every shop an affiliate
  // referred sales to. Nullable only for a pre-split row predating that.
  business_id: string | null
  amount: number
  status: AffiliatePayoutStatus
  requested_at: string
  paid_at: string | null
  notes: string | null
  affiliates?: { full_name: string; code: string; payout_details?: string | null } | null
  businesses?: { name: string; slug: string } | null
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
