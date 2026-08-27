import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import AnalyticsClient from '@/components/business/AnalyticsClient'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export const revalidate = 0

export default async function SellAnalyticsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    salesResult,
    itemsResult,
    expensesResult,
    ingredientsResult,
    productsResult
  ] = await Promise.all([
    supabase.from('sales').select('total, created_at').eq('business_id', business.id).gte('created_at', startOfMonth),
    supabase
      .from('sale_items')
      .select('quantity, selling_price, product_id, custom_name, computed_cogs, sales!inner(created_at, business_id), store_products(name, cost_price, category_id)')
      .eq('sales.business_id', business.id),
    supabase.from('operating_expenses').select('amount').eq('business_id', business.id).gte('billing_period', startOfMonth),
    supabase.from('ingredients').select('id, name, current_stock, min_stock_alert, cost_per_unit, unit_type').eq('business_id', business.id),
    supabase.from('store_products').select('id, name, category_id, categories(name), recipes(ingredient_id, quantity_used)').eq('business_id', business.id)
  ])

  const salesRaw = salesResult.data ?? []
  const itemsRaw = itemsResult.data ?? []
  const expensesRaw = expensesResult.data ?? []
  const ingredientsRaw = ingredientsResult.data ?? []
  const productsRaw = productsResult.data ?? []

  if (salesResult.error || itemsResult.error || expensesResult.error || ingredientsResult.error || productsResult.error) {
    console.error('Analytics query error:', {
      salesErr: salesResult.error?.message,
      itemsErr: itemsResult.error?.message,
      expensesErr: expensesResult.error?.message,
      ingredientsErr: ingredientsResult.error?.message,
      productsErr: productsResult.error?.message
    })
    return (
      <Alert variant="destructive" className="mx-auto m-6 max-w-2xl">
        <AlertCircle />
        <AlertTitle>Analytics Calculation Error</AlertTitle>
        <AlertDescription>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-foreground p-3 font-mono text-[11px] text-background">
            {salesResult.error?.message || itemsResult.error?.message || 'Unknown error.'}
          </pre>
        </AlertDescription>
      </Alert>
    )
  }

  const productCostMap: Record<number, number> = {}
  // Whether the product has any recipe row at all — the correct switch
  // between "cost from ingredients" and "cost from cost_price" (mirrors the
  // SQL's COALESCE(SUM(...), cost_price) in process_sale(), which falls
  // back on an empty recipe, not on a recipe that happens to compute to 0).
  // A recipe of free/zero-cost ingredients is a real, valid recipe cost of
  // ₱0 — it must not fall through to cost_price, which is itself hardcoded
  // to 0 for every recipe-based product (see saveProductAction), so that
  // mistake would silently agree with itself here instead of surfacing.
  const productHasRecipeMap: Record<number, boolean> = {}
  const productCategoryNameMap: Record<number, string> = {}

  productsRaw.forEach(p => {
    const catName = (p.categories as unknown as { name: string } | null)?.name ?? 'Uncategorized'
    productCategoryNameMap[p.id] = catName

    const hasRecipe = Boolean(p.recipes && p.recipes.length > 0)
    productHasRecipeMap[p.id] = hasRecipe
    if (hasRecipe && p.recipes) {
      // Ingredient cost is looked up live from ingredientsRaw (not the
      // quantity_used snapshot alone), so a price change on an ingredient
      // is reflected retroactively across this month's past sales too, not
      // just future ones — same intent as the comment below on cost.
      const computedRecipeCost = p.recipes.reduce((sum, r) => {
        const ing = ingredientsRaw.find(i => i.id === r.ingredient_id)
        return sum + (Number(ing?.cost_per_unit ?? 0) * Number(r.quantity_used))
      }, 0)
      productCostMap[p.id] = computedRecipeCost
    } else {
      productCostMap[p.id] = 0
    }
  })

  let grossRevenue = 0
  let totalCOGS = 0
  let todayRevenue = 0
  let todayCOGS = 0

  const productSalesMap: Record<string, { qty: number; revenue: number; cogs: number }> = {}
  const categoryRevenueMap: Record<string, number> = {}

  itemsRaw.forEach(item => {
    const prod = item.store_products as unknown as { name: string; cost_price: number } | null
    const productId = item.product_id
    // A custom (non-catalog) line has no store_products row — fall back to
    // the free-text name it was rung up with, same as the receipt drawer.
    const prodName = prod?.name ?? item.custom_name ?? 'Unknown Item'
    const catName = (productId && productCategoryNameMap[productId]) ?? 'Standard Catalog'

    const qty = Number(item.quantity || 0)
    const sPrice = Number(item.selling_price || 0)
    const calculatedItemTotalRevenue = sPrice * qty

    // Catalog lines recompute cost live from current recipe/cost_price data
    // (so an ingredient price change is reflected retroactively across past
    // sales, not just future ones). A custom line has no such live source —
    // its cost was a one-time manual entry at sale time — so it uses the
    // computed_cogs process_sale() already stored for that exact line.
    let calculatedItemTotalCogs: number
    if (productId) {
      const finalUnitCogs = productHasRecipeMap[productId]
        ? (productCostMap[productId] ?? 0)
        : Number(prod?.cost_price || 0)
      calculatedItemTotalCogs = finalUnitCogs * qty
    } else {
      calculatedItemTotalCogs = Number(item.computed_cogs || 0)
    }

    grossRevenue += calculatedItemTotalRevenue
    totalCOGS += calculatedItemTotalCogs

    const parentSaleInfo = item.sales as unknown as { created_at: string } | null
    const itemCreatedAt = new Date(parentSaleInfo?.created_at || '').getTime()
    const todayMidnightAt = new Date(startOfToday).getTime()

    if (itemCreatedAt >= todayMidnightAt) {
      todayRevenue += calculatedItemTotalRevenue
      todayCOGS += calculatedItemTotalCogs
    }

    if (prodName) {
      if (!productSalesMap[prodName]) {
        productSalesMap[prodName] = { qty: 0, revenue: 0, cogs: 0 }
      }
      productSalesMap[prodName].qty += qty
      productSalesMap[prodName].revenue += calculatedItemTotalRevenue
      productSalesMap[prodName].cogs += calculatedItemTotalCogs
    }

    categoryRevenueMap[catName] = (categoryRevenueMap[catName] || 0) + calculatedItemTotalRevenue
  })

  const grossProfit = grossRevenue - totalCOGS
  const totalOpEx = expensesRaw.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
  const netProfit = grossProfit - totalOpEx
  const profitMarginPercentage = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({
      name,
      qty: data.qty,
      revenue: data.revenue,
      profit: data.revenue - data.cogs
    }))
    .sort((a, b) => b.qty - a.qty)

  const categoryShares = Object.entries(categoryRevenueMap).map(([name, value]) => ({ name, value }))

  const lowStockIngredients = ingredientsRaw
    .filter(ing => Number(ing.current_stock) <= Number(ing.min_stock_alert))
    .map(ing => ({
      name: ing.name,
      current_stock: Number(ing.current_stock),
      min_stock_alert: Number(ing.min_stock_alert),
      unit_type: ing.unit_type
    }))

  return (
    <AnalyticsClient
      businessType={business.business_type}
      salesRaw={salesRaw}
      topProducts={topProducts}
      categoryShares={categoryShares}
      lowStockIngredients={lowStockIngredients}
      ingredientsCostList={ingredientsRaw.map(i => ({ name: i.name, cost: Number(i.cost_per_unit || 0), unit_type: i.unit_type }))}
      kpis={{
        grossRevenue,
        totalCOGS,
        grossProfit,
        totalOpEx,
        netProfit,
        profitMarginPercentage,
        todayRevenue,
        todayProfit: todayRevenue - todayCOGS
      }}
    />
  )
}
