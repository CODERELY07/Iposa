import type { BusinessType } from '@/lib/types/marketplace'

// Everything the /sell dashboard needs to know to adapt itself to a
// business's chosen type. This is deliberately just vocabulary + feature
// toggles, NOT a second costing engine: every business type reuses the same
// store_products table (and the same process_sale()/place_order()/analytics
// math) that already computes real per-unit cost. What actually changes per
// type is what that pipeline is *for*:
//   - restaurant: ingredients are food stock; a recipe is a dish's bill of
//     materials; COGS comes from ingredients actually consumed; each dish
//     has a finite stock (manual, or derived from ingredient supply).
//   - services: a catalog of named services (Print, Photocopy, Lamination —
//     or Cellphone LCD Replacement, Battery Replacement — whatever the
//     business does), each just a name, description and price. There's no
//     bill of materials and no finite stock to track — a service is never
//     "out of stock" (see store_products.track_stock) — plus "custom items"
//     in POS for one-off jobs that were never worth cataloguing (a rush
//     order, an odd quote). This replaced the earlier, narrower 'print_shop'
//     value: printing is just one kind of service business among many.
//   - retail: no bill of materials at all — a product's own cost_price
//     (what you paid your supplier) IS its COGS, and it has a real finite
//     stock count. There is nothing to build a recipe out of, so that whole
//     layer (and the Ingredients/Materials nav item) is hidden rather than
//     shown empty.
export type BusinessTypeMeta = {
  value: BusinessType
  label: string
  shortLabel: string
  tagline: string
  description: string
  /** How COGS is computed, in one line — shown on the registration card. */
  costingSummary: string
  /** "Ingredients" vs "Materials" — used on the sidebar nav + that page's copy. */
  materialLabel: string
  materialLabelSingular: string
  /** "Recipe" vs "Job Materials" — the bill-of-materials section on a product. */
  recipeLabel: string
  /** Whether this type tracks a raw-stock ledger + bills of materials at all. */
  showMaterialsNav: boolean
  showRecipeSection: boolean
  /** "Products" vs "Services" — the catalog page/nav item's own name. */
  catalogLabel: string
  catalogLabelSingular: string
  /** Whether a catalog row has a real finite stock count at all (false = always available, e.g. a service). */
  tracksStock: boolean
  /** How prominently POS should surface the ad-hoc custom-priced item form. */
  customItemEmphasis: 'primary' | 'secondary'
}

export const BUSINESS_TYPE_META: Record<BusinessType, BusinessTypeMeta> = {
  restaurant: {
    value: 'restaurant',
    label: 'Restaurant / Food & Beverage',
    shortLabel: 'Restaurant',
    tagline: 'Dishes made from ingredients',
    description:
      'Menu items are built from ingredients you stock. Attach a recipe to a dish and its food cost is calculated automatically from what it actually consumes.',
    costingSummary: 'Cost per dish = ingredients consumed × their cost — computed live from your recipes.',
    materialLabel: 'Ingredients',
    materialLabelSingular: 'ingredient',
    recipeLabel: 'Recipe',
    showMaterialsNav: true,
    showRecipeSection: true,
    catalogLabel: 'Products',
    catalogLabelSingular: 'Product',
    tracksStock: true,
    customItemEmphasis: 'secondary',
  },
  services: {
    value: 'services',
    label: 'Services',
    shortLabel: 'Services',
    tagline: 'A catalog of services you perform',
    description:
      'Printing, repairs, salons, cleaning — anything you charge per job. Add each service you offer with a name and description (e.g. Print, Photocopy, Lamination — or Cellphone LCD Replacement, Battery Replacement), set its price, and it\'s ready to sell. A service is never "out of stock," and you can still ring up a one-off custom job on the spot when something isn\'t worth cataloguing.',
    costingSummary: 'Cost per service = whatever you set on it (optional) — there\'s no stock to run out of.',
    materialLabel: 'Ingredients',
    materialLabelSingular: 'ingredient',
    recipeLabel: 'Recipe',
    showMaterialsNav: false,
    showRecipeSection: false,
    catalogLabel: 'Services',
    catalogLabelSingular: 'Service',
    tracksStock: false,
    customItemEmphasis: 'primary',
  },
  retail: {
    value: 'retail',
    label: 'Retail / Single Product',
    shortLabel: 'Retail',
    tagline: 'Finished goods you stock',
    description:
      'You sell finished goods you already have on hand — one flagship product or a small catalog. Cost is whatever you paid your supplier, tracked directly on the product, no recipe needed.',
    costingSummary: 'Cost per unit = the supplier cost you set directly on the product.',
    materialLabel: 'Ingredients',
    materialLabelSingular: 'ingredient',
    recipeLabel: 'Recipe',
    showMaterialsNav: false,
    showRecipeSection: false,
    catalogLabel: 'Products',
    catalogLabelSingular: 'Product',
    tracksStock: true,
    customItemEmphasis: 'secondary',
  },
}

export const BUSINESS_TYPE_OPTIONS = Object.values(BUSINESS_TYPE_META)

export function getBusinessTypeMeta(type: string | null | undefined): BusinessTypeMeta {
  return BUSINESS_TYPE_META[type as BusinessType] ?? BUSINESS_TYPE_META.retail
}
