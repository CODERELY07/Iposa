'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

type Props = {
  salesRaw: { total: number; created_at: string }[]
  topProducts: { name: string; qty: number; revenue: number; profit: number }[]
  categoryShares: { name: string; value: number }[]
  lowStockIngredients: { name: string; current_stock: number; min_stock_alert: number }[]
  ingredientsCostList: { name: string; cost: number }[]
  kpis: {
    grossRevenue: number
    totalCOGS: number
    grossProfit: number
    totalOpEx: number
    netProfit: number
    profitMarginPercentage: number
    todayRevenue: number
    todayProfit: number
  }
}

export default function AnalyticsClient({ salesRaw, topProducts, categoryShares, lowStockIngredients, ingredientsCostList, kpis }: Props) {

  // Computes the past 7 days of sales for trend monitoring
  const revenueChartData = useMemo(() => {
    const daysMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      daysMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
    }
    salesRaw.forEach(sale => {
      const label = new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (label in daysMap) daysMap[label] += Number(sale.total)
    })
    return {
      labels: Object.keys(daysMap),
      datasets: [
        {
          fill: true,
          label: 'Sales Revenue Timeline (₱)',
          data: Object.values(daysMap),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          tension: 0.2,
          borderWidth: 2,
        },
      ],
    }
  }, [salesRaw])

  const categoryChartData = useMemo(() => ({
    labels: categoryShares.map(c => c.name),
    datasets: [
      {
        data: categoryShares.map(c => c.value),
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'],
        borderWidth: 2,
      }
    ]
  }), [categoryShares])

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6 bg-zinc-50 min-h-full">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Performance metrics across recipe costing, daily and monthly windows, and net margins.</p>
        </div>

        <div className="flex gap-2 bg-indigo-50 border border-indigo-100 p-3 rounded-xl shadow-xs">
          <div className="pr-4 border-r border-indigo-200/60">
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Today&apos;s Sales</span>
            <h4 className="text-sm font-mono font-black text-indigo-700 mt-0.5">
              ₱{kpis.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
          </div>
          <div className="pl-2">
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Today&apos;s Net Margin</span>
            <h4 className="text-sm font-mono font-black text-emerald-600 mt-0.5">
              ₱{kpis.todayProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Monthly Revenue</span>
          <h3 className="text-lg font-mono font-bold text-zinc-900 mt-1">₱{kpis.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-zinc-400">Total volume sold</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm border-l-4 border-l-red-400">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Monthly COGS</span>
          <h3 className="text-lg font-mono font-bold text-red-600 mt-1">₱{kpis.totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-zinc-400">Recipe + direct costs</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Monthly Gross Profit</span>
          <h3 className="text-lg font-mono font-bold text-blue-600 mt-1">₱{kpis.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-zinc-500">Revenue minus COGS</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm border-l-4 border-l-amber-500">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Monthly OpEx</span>
          <h3 className="text-lg font-mono font-bold text-amber-600 mt-1">₱{kpis.totalOpEx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-zinc-500">Fixed operational bills</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Monthly Net Profit</span>
          <h3 className="text-lg font-mono font-bold text-emerald-600 mt-1">₱{kpis.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-zinc-500">Clean cash remaining</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Net Profit Margin</span>
          <h3 className={`text-lg font-mono font-bold mt-1 ${kpis.profitMarginPercentage > 20 ? 'text-emerald-600' : 'text-red-600'}`}>
            {kpis.profitMarginPercentage.toFixed(1)}%
          </h3>
          <span className="text-[10px] text-zinc-400">Target parameter {'>'} 20%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-4">Sales Timeline (7 days)</h3>
          <div className="relative h-64 w-full">
            <Line data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-4">Category Shares</h3>
          <div className="relative h-64 w-full flex items-center justify-center">
            {categoryShares.length === 0 ? (
              <span className="text-xs text-zinc-400 font-medium">No sales metrics recorded.</span>
            ) : (
              <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3">Product Volume & Margins</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-bold bg-zinc-50/50">
                  <th className="p-3">Product</th>
                  <th className="p-3 text-center">Units Sold</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {topProducts.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-zinc-400 italic">No checkout items logged this month.</td></tr>
                ) : (
                  topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-zinc-50/40 transition">
                      <td className="p-3 font-bold text-zinc-900">{p.name}</td>
                      <td className="p-3 text-center font-mono">{p.qty} pcs</td>
                      <td className="p-3 text-right font-mono">₱{p.revenue.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">₱{p.profit.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3 text-red-600">Low Stock Ingredients ({lowStockIngredients.length})</h3>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {lowStockIngredients.length === 0 ? (
                <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg font-medium text-center">
                  ✓ All raw ingredients safely buffered above trigger marks.
                </div>
              ) : (
                lowStockIngredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-red-50/50 border border-red-100 p-2.5 rounded-lg">
                    <span className="font-bold text-zinc-900">{ing.name}</span>
                    <span className="font-mono font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-100">
                      {ing.current_stock} remaining (Alert @ {ing.min_stock_alert})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3 text-blue-600">Ingredient Cost Matrix</h3>
            <div className="space-y-1.5 max-h-44 overflow-y-auto font-medium text-xs">
              {ingredientsCostList.map((ing, idx) => (
                <div key={idx} className="flex justify-between p-2 hover:bg-zinc-50 rounded transition">
                  <span className="text-zinc-700">{ing.name}</span>
                  <span className="font-mono text-zinc-900 font-bold">₱{ing.cost.toFixed(4)} / unit</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
