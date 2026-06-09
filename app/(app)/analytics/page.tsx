import { createClient } from '@/lib/supabase/server'
import AnalyticsClient from '@/components/inventory/AnalyticsClient'

export const revalidate = 0

export default async function AnalyticsPage() {
  const supabase = await createClient()
  
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 1. EXECUTE DATABASE QUERIES SAFELY WITH COALESCED FALLBACKS
  const [
    salesResult,
    itemsResult,
    expensesResult,
    ingredientsResult,
    productsResult
  ] = await Promise.all([
    supabase.from('sales').select('total, created_at').gte('created_at', startOfMonth),
    supabase.from('sale_items').select('quantity, selling_price, product_id, products(name, cost_price, category_id)'),
    supabase.from('operating_expenses').select('amount').gte('billing_period', startOfMonth),
    supabase.from('ingredients').select('id, name, current_stock, min_stock_alert, cost_per_unit'),
    supabase.from('products').select('id, name, category_id, categories(name), recipes(ingredient_id, quantity_used)')
  ])

  // Extract data arrays or fallback to empty arrays to prevent mapping over null pointers
  const salesRaw = salesResult.data ?? []
  const itemsRaw = itemsResult.data ?? []
  const expensesRaw = expensesResult.data ?? []
  const ingredientsRaw = ingredientsResult.data ?? []
  const productsRaw = productsResult.data ?? []

  // Check if any query crashed entirely due to structural errors
  if (salesResult.error || itemsResult.error || expensesResult.error || ingredientsResult.error || productsResult.error) {
    console.error("Analytics Calculation Error Dump:", {
      salesErr: salesResult.error?.message,
      itemsErr: itemsResult.error?.message,
      expensesErr: expensesResult.error?.message,
      ingredientsErr: ingredientsResult.error?.message,
      productsErr: productsResult.error?.message
    })
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl border border-red-100 max-w-2xl mx-auto shadow-sm">
        <h3 className="font-bold text-base mb-1">F&B Engine Data Calculation Error</h3>
        <p className="text-xs text-red-500 font-medium mb-3">The analytics pipeline failed to compile structural aggregates. Details:</p>
        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre-wrap">
          {salesResult.error?.message || itemsResult.error?.message || expensesResult.error?.message || ingredientsResult.error?.message || productsResult.error?.message || "Null payload constraint error."}
        </pre>
      </div>
    )
  }

  // 2. CONSTRUCT DICTIONARIES FOR REAL-TIME COST & CATEGORY ROUTING
  const productCostMap: Record<number, number> = {}
  const productCategoryNameMap: Record<number, string> = {}
  
  productsRaw.forEach(p => {
    // Map the category name directly using the inner join reference
    const catName = (p.categories as any)?.name ?? 'Uncategorized'
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

  // 3. COMPUTE FINANCIAL STATEMENTS
  let grossRevenue = 0
  let totalCOGS = 0

  const productSalesMap: Record<string, { qty: number; revenue: number; cogs: number }> = {}
  const categoryRevenueMap: Record<string, number> = {}

  itemsRaw.forEach(item => {
    const prod = item.products as any
    const productId = item.product_id
    const prodName = prod?.name ?? 'Unknown Item'
    
    // Fallback to our compiled products routing map to fetch structural category details reliably
    const catName = productCategoryNameMap[productId] ?? 'Standard Catalog'
    
    const qty = Number(item.quantity || 0)
    const sPrice = Number(item.selling_price || 0)
    
    const recipeCost = productCostMap[productId] ?? 0
    const finalUnitCogs = recipeCost > 0 ? recipeCost : Number(prod?.cost_price || 0)
    
    const calculatedItemTotalRevenue = sPrice * qty
    const calculatedItemTotalCogs = finalUnitCogs * qty

    grossRevenue += calculatedItemTotalRevenue
    totalCOGS += calculatedItemTotalCogs

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

  // 4. MAP PROPS STRUCTURES safely
  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ 
      name, 
      qty: data.qty,
      revenue: data.revenue,
      profit: data.revenue - data.cogs
    }))
    .sort((a, b) => b.qty - a.qty)

  const categoryShares = Object.entries(categoryRevenueMap).map(([name, value]) => ({
    name,
    value
  }))

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
        profitMarginPercentage
      }}
    />
  )
}