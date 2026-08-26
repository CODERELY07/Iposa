import Link from 'next/link'
import { requireBusinessAccount, createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function SellDashboardPage() {
  const { business } = await requireBusinessAccount()

  if (!business) {
    return null // layout already redirects this case
  }

  if (business.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-4xl mb-3">⏳</p>
        <h1 className="text-xl font-bold text-zinc-900">Your application is under review</h1>
        <p className="text-sm text-zinc-500 mt-2">
          <span className="font-semibold text-zinc-700">{business.name}</span> is waiting for approval
          from the marketplace team. You&apos;ll be able to manage products and orders once it&apos;s approved.
        </p>
      </div>
    )
  }

  if (business.status === 'rejected') {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-4xl mb-3">✕</p>
        <h1 className="text-xl font-bold text-zinc-900">Application not approved</h1>
        <p className="text-sm text-zinc-500 mt-2">
          <span className="font-semibold text-zinc-700">{business.name}</span> was not approved.
        </p>
        {business.rejection_reason && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mt-4 inline-block">
            {business.rejection_reason}
          </p>
        )}
      </div>
    )
  }

  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    { count: productCount },
    { count: pendingOrderCount },
    { data: salesToday, error: salesErr },
    { data: lowStockProducts, error: stockErr },
    { data: topSellingItems, error: itemsErr },
  ] = await Promise.all([
    supabase.from('store_products').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase
      .from('store_orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pending'),
    // In-person POS sales recorded today
    supabase.from('sales').select('total').eq('business_id', business.id).gte('created_at', todayISO),
    // Products running low (under 10 units), standalone stock only — recipe-based
    // products derive live stock from ingredients instead (see Products/Analytics).
    supabase
      .from('store_products')
      .select('id, name, sku, stock')
      .eq('business_id', business.id)
      .lt('stock', 10)
      .order('stock', { ascending: true })
      .limit(5),
    // Top moving products by units sold, in-store
    supabase
      .from('sale_items')
      .select('product_id, quantity, sales!inner(business_id), store_products(name, sku)')
      .eq('sales.business_id', business.id),
  ])

  if (salesErr || stockErr || itemsErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to calculate business metrics: {salesErr?.message ?? stockErr?.message ?? itemsErr?.message}
      </div>
    )
  }

  const totalRevenueToday = (salesToday ?? []).reduce((sum, item) => sum + Number(item.total), 0)
  const totalTransactionsToday = (salesToday ?? []).length

  const dynamicSalesMap: Record<number, { name: string; sku: string; qty: number }> = {}
  ;(topSellingItems ?? []).forEach(item => {
    const pId = item.product_id
    if (!pId) return
    const prodDetails = item.store_products as unknown as { name: string; sku: string | null } | null
    if (prodDetails) {
      if (!dynamicSalesMap[pId]) {
        dynamicSalesMap[pId] = { name: prodDetails.name, sku: prodDetails.sku ?? 'No SKU', qty: 0 }
      }
      dynamicSalesMap[pId].qty += item.quantity ?? 0
    }
  })
  const sortedTopProducts = Object.values(dynamicSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5)

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Welcome back, {business.name}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Here&apos;s how your business is doing.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">POS Revenue Today</span>
          <h3 className="text-2xl font-mono font-bold text-zinc-900 mt-2">
            ₱{totalRevenueToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1">{totalTransactionsToday} transactions since midnight</p>
        </div>
        <Link href="/sell/products" className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Products listed</span>
          <h3 className="text-2xl font-bold text-zinc-900 mt-2">{productCount ?? 0}</h3>
        </Link>
        <Link href="/sell/orders" className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Online orders awaiting action</span>
          <h3 className="text-2xl font-bold text-zinc-900 mt-2">{pendingOrderCount ?? 0}</h3>
        </Link>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Low stock items</span>
          <h3 className="text-2xl font-bold text-zinc-900 mt-2">{lowStockProducts?.length ?? 0}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-zinc-900">Top Moving Stock (POS)</h4>
            <p className="text-[11px] text-zinc-400">Most frequent in-store products by units sold.</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            {sortedTopProducts.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                No POS sales recorded yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                    <th className="p-2 rounded-l-md">Product</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2 text-right rounded-r-md">Units Sold</th>
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

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-zinc-900">Low Stock Alerts</h4>
            <p className="text-[11px] text-zinc-400">Standalone products under 10 units remaining.</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            {(lowStockProducts ?? []).length === 0 ? (
              <div className="text-center py-12 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-lg">
                🎉 All products are fully stocked above the threshold.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                    <th className="p-2 rounded-l-md">Product</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2 text-right rounded-r-md">Stock</th>
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
