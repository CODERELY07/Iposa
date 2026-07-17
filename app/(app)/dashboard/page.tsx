import { createClient, requireUserRole } from '@/lib/supabase/server'

export const revalidate = 0 // Ensure metrics update live on every navigation click

export default async function DashboardPage() {
  await requireUserRole(['admin'])
  const supabase = await createClient()

  // Generate an ISO string timestamp for the start of today (00:00:00 local time)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  // Execute concurrent requests to keep data fetching parallel and lightning fast
  const [
    { data: salesToday, error: salesErr },
    { data: lowStockProducts, error: stockErr },
    { data: topSellingItems, error: itemsErr }
  ] = await Promise.all([
    // 1. Fetch sales recorded starting from midnight today
    supabase
      .from('sales')
      .select('total')
      .gte('created_at', todayISO),

    // 2. Scan products hitting the critical stock warning line (under 10 units)
    supabase
      .from('products')
      .select('id, name, sku, stock')
      .lt('stock', 10)
      .order('stock', { ascending: true })
      .limit(5),

    // 3. Fetch top moving products based on total volume sold
    supabase
      .from('sale_items')
      .select('product_id, quantity, products(name, sku)')
  ])

  if (salesErr || stockErr || itemsErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to calculate business analytics: {salesErr?.message ?? stockErr?.message ?? itemsErr?.message}
      </div>
    )
  }

  // Calculate high-performance client-side KPI rollups
  const totalRevenueToday = (salesToday ?? []).reduce((sum, item) => sum + Number(item.total), 0)
  const totalTransactionsToday = (salesToday ?? []).length

  // Aggregate quantities grouped by product_id manually to bypass creating complex database views
  const dynamicSalesMap: Record<number, { name: string; sku: string; qty: number }> = {}
  
  ;(topSellingItems ?? []).forEach(item => {
    const pId = item.product_id
    // Cast to access nested relational profile joins safely
    const prodDetails = item.products as unknown as { name: string; sku: string | null }
    
    if (prodDetails) {
      if (!dynamicSalesMap[pId]) {
        dynamicSalesMap[pId] = {
          name: prodDetails.name,
          sku: prodDetails.sku ?? 'No SKU',
          qty: 0
        }
      }
      dynamicSalesMap[pId].qty += item.quantity ?? 0
    }
  })

  // Sort and isolate the top 5 most frequent items on the ticket stack
  const sortedTopProducts = Object.values(dynamicSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-zinc-50 min-h-[calc(100vh-4rem)]">
      
      {/* Dashboard Section Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Business Operations Summary</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Real-time store diagnostic insights and metrics.</p>
      </div>

      {/* THREE MAIN KPI CARD BADGES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metric Card 1: Today's Revenue */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gross Income Today</span>
            <span className="text-lg bg-emerald-50 text-emerald-600 p-1.5 rounded-lg font-bold">₱</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-mono font-bold text-zinc-900">
              ₱{totalRevenueToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1">Calculated since 12:00 AM today</p>
          </div>
        </div>

        {/* Metric Card 2: Today's Order Volume */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">Ticket Activity</span>
            <span className="text-sm bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md font-bold font-mono">#</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 font-mono">
              {totalTransactionsToday} <span className="text-sm font-normal font-sans text-zinc-400">orders</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1">Total checkout sessions submitted</p>
          </div>
        </div>

        {/* Metric Card 3: Warning Stock Counters */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stock Alerts</span>
            <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full">Low Warning</span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-zinc-900 font-mono">
              {lowStockProducts?.length ?? 0} <span className="text-sm font-normal font-sans text-zinc-400">items low</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1">Available stock inventory counts under 10 units</p>
          </div>
        </div>

      </div>

      {/* SPLIT SCREEN DATATABLES FOR LOGISTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* WIDGET LEFT: Top Selling Velocity Items */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-zinc-900">Top Moving Stock</h4>
            <p className="text-[11px] text-zinc-400">Most frequent products sorted by total volume sold.</p>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            {sortedTopProducts.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                No orders have been run through the POS system yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                    <th className="p-2 rounded-l-md">Product Description</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2 text-right rounded-r-md">Units Redeemed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 text-xs">
                  {sortedTopProducts.map((p, index) => (
                    <tr key={index} className="hover:bg-zinc-50/50 transition">
                      <td className="p-2.5 font-medium text-zinc-800 max-w-[220px] truncate">{p.name}</td>
                      <td className="p-2.5 font-mono text-zinc-400">{p.sku}</td>
                      <td className="p-2.5 text-right font-semibold font-mono text-emerald-600">{p.qty}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* WIDGET RIGHT: Low Inventory Urgent Action Board */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-zinc-900">Urgent Restock Registry</h4>
            <p className="text-[11px] text-zinc-400">Immediate priority items requiring inventory adjustments.</p>
          </div>

          <div className="flex-1 overflow-x-auto">
            {(lowStockProducts ?? []).length === 0 ? (
              <div className="text-center py-12 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-lg">
                🎉 Excellent. All products are fully stocked above the threshold limit.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                    <th className="p-2 rounded-l-md">Product Description</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2 text-right rounded-r-md">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 text-xs">
                  {(lowStockProducts ?? []).map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition">
                      <td className="p-2.5 font-medium text-zinc-800 max-w-[220px] truncate">{p.name}</td>
                      <td className="p-2.5 font-mono text-zinc-400">{p.sku ?? 'N/A'}</td>
                      <td className="p-2.5 text-right font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          p.stock === 0 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {p.stock === 0 ? 'Out of Stock' : `${p.stock} units remaining`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}   