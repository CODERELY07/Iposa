import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import AnalyticsClient from '@/components/business/AnalyticsClient'

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
      .select('quantity, selling_price, product_id, sales!inner(created_at, business_id), store_products(name, cost_price, category_id)')
      .eq('sales.business_id', business.id),
    supabase.from('operating_expenses').select('amount').eq('business_id', business.id).gte('billing_period', startOfMonth),
    supabase.from('ingredients').select('id, name, current_stock, min_stock_alert, cost_per_unit').eq('business_id', business.id),
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
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl border border-red-100 max-w-2xl mx-auto shadow-sm">
        <h3 className="font-bold text-base mb-1">Analytics Calculation Error</h3>
        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre-wrap">
          {salesResult.error?.message || itemsResult.error?.message || 'Unknown error.'}
        </pre>
      </div>
    )
  }

  const productCostMap: Record<number, number> = {}
  const productCategoryNameMap: Record<number, string> = {}

  productsRaw.forEach(p => {
    const catName = (p.categories as unknown as { name: string } | null)?.name ?? 'Uncategorized'
    productCategoryNameMap[p.id] = catName

    const hasRecipe = p.recipes && p.recipes.length > 0
    if (hasRecipe && p.recipes) {
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
    const prodName = prod?.name ?? 'Unknown Item'
    const catName = (productId && productCategoryNameMap[productId]) ?? 'Standard Catalog'

    const qty = Number(item.quantity || 0)
    const sPrice = Number(item.selling_price || 0)

    const recipeCost = (productId && productCostMap[productId]) ?? 0
    const finalUnitCogs = recipeCost > 0 ? recipeCost : Number(prod?.cost_price || 0)

    const calculatedItemTotalRevenue = sPrice * qty
    const calculatedItemTotalCogs = finalUnitCogs * qty

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
      min_stock_alert: Number(ing.min_stock_alert)
    }))

  return (
    <AnalyticsClient
      salesRaw={salesRaw}
      topProducts={topProducts}
      categoryShares={categoryShares}
      lowStockIngredients={lowStockIngredients}
      ingredientsCostList={ingredientsRaw.map(i => ({ name: i.name, cost: Number(i.cost_per_unit || 0) }))}
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
