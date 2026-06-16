import { createClient } from '@/lib/supabase/server'
import AnalyticsClient from '@/components/inventory/AnalyticsClient'

export const revalidate = 0

export default async function AnalyticsPage() {
  const supabase = await createClient()
  
  const now = new Date()
  
  // 1. TIMESTAMPS: Monthly vs Daily Reset Windows
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  
  // Isolated Today: Sets to midnight 00:00:00 of the current day
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // 2. EXECUTE DATABASE QUERIES SAFELY
  const [
    salesResult,
    itemsResult,
    expensesResult,
    ingredientsResult,
    productsResult
  ] = await Promise.all([
    // We grab everything from the start of the month so chart timelines and monthly KPIs work flawlessly
    supabase.from('sales').select('total, created_at').gte('created_at', startOfMonth),
    
    // Grab items with embedded product properties and join parent sales record for timestamp routing
    supabase.from('sale_items').select('quantity, selling_price, product_id, sales(created_at), products(name, cost_price, category_id)'),
    
    supabase.from('operating_expenses').select('amount').gte('billing_period', startOfMonth),
    supabase.from('ingredients').select('id, name, current_stock, min_stock_alert, cost_per_unit'),
    supabase.from('products').select('id, name, category_id, categories(name), recipes(ingredient_id, quantity_used)')
  ])

  // Extract data arrays safely
  const salesRaw = salesResult.data ?? []
  const itemsRaw = itemsResult.data ?? []
  const expensesRaw = expensesResult.data ?? []
  const ingredientsRaw = ingredientsResult.data ?? []
  const productsRaw = productsResult.data ?? []

  // Structural error dump fail-safe
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
        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre-wrap">
          {salesResult.error?.message || itemsResult.error?.message || "Null payload constraint error."}
        </pre>
      </div>
    )
  }

  // 3. CONSTRUCT DICTIONARIES FOR REAL-TIME COST & CATEGORY ROUTING
  const productCostMap: Record<number, number> = {}
  const productCategoryNameMap: Record<number, string> = {}
  
  productsRaw.forEach(p => {
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

  // 4. METRIC REGISTERS (Splitting Monthly vs Today's Live Trackers)
  let grossRevenue = 0
  let totalCOGS = 0
  
  let todayRevenue = 0
  let todayCOGS = 0

  const productSalesMap: Record<string, { qty: number; revenue: number; cogs: number }> = {}
  const categoryRevenueMap: Record<string, number> = {}

  itemsRaw.forEach(item => {
    const prod = item.products as any
    const productId = item.product_id
    const prodName = prod?.name ?? 'Unknown Item'
    const catName = productCategoryNameMap[productId] ?? 'Standard Catalog'
    
    const qty = Number(item.quantity || 0)
    const sPrice = Number(item.selling_price || 0)
    
    const recipeCost = productCostMap[productId] ?? 0
    const finalUnitCogs = recipeCost > 0 ? recipeCost : Number(prod?.cost_price || 0)
    
    const calculatedItemTotalRevenue = sPrice * qty
    const calculatedItemTotalCogs = finalUnitCogs * qty

    // A. Add to Monthly Pools
    grossRevenue += calculatedItemTotalRevenue
    totalCOGS += calculatedItemTotalCogs

    // B. Add to Today's Live Pools (Extract timestamp via the joined parent sales relation tracking)
    const parentSaleInfo = item.sales as any
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

  // Formulating structured client returns
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
      startOfToday={startOfToday}
      kpis={{
        grossRevenue,
        totalCOGS,
        grossProfit,
        totalOpEx,
        netProfit,
        profitMarginPercentage,
        todayRevenue,               // New daily KPI property
        todayProfit: todayRevenue - todayCOGS // New daily KPI property
      }}
    />
  )
}