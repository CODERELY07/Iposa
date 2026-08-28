'use client'

import { useMemo } from 'react'
import Link from 'next/link'
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
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { CheckCircle2 } from 'lucide-react'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import { unitLabel } from '@/lib/business/units'
import type { BusinessType } from '@/lib/types/marketplace'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

// Matches the brand chart tokens defined in globals.css (--chart-1..5).
const CHART_COLORS = ['#6d4aff', '#f59e0b', '#0d9488', '#ec4899', '#0ea5e9']

type Props = {
  businessType: BusinessType
  salesRaw: { total: number; created_at: string }[]
  topProducts: { name: string; qty: number; revenue: number; profit: number }[]
  categoryShares: { name: string; value: number }[]
  expensesBreakdown: { title: string; description: string | null; amount: number }[]
  lowStockIngredients: { name: string; current_stock: number; min_stock_alert: number; unit_type: string }[]
  ingredientsCostList: { name: string; cost: number; unit_type: string }[]
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

export default function AnalyticsClient({ businessType, salesRaw, topProducts, categoryShares, expensesBreakdown, lowStockIngredients, ingredientsCostList, kpis }: Props) {
  const meta = getBusinessTypeMeta(businessType)

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
          borderColor: CHART_COLORS[0],
          backgroundColor: 'color-mix(in srgb, ' + CHART_COLORS[0] + ' 10%, transparent)',
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
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
      }
    ]
  }), [categoryShares])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Analytics</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Performance metrics across recipe costing, daily and monthly windows, and net margins.</p>
        </div>

        <Card className="flex-row gap-0 divide-x bg-gradient-brand-soft p-3">
          <div className="pr-4">
            <span className="block text-[9px] font-bold font-mono uppercase tracking-wider text-primary">Today&apos;s Sales</span>
            <h4 className="mt-0.5 font-mono text-sm font-black text-foreground">
              ₱{kpis.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
          </div>
          <div className="pl-4">
            <span className="block text-[9px] font-bold font-mono uppercase tracking-wider text-primary">Today&apos;s Net Margin</span>
            <h4 className="mt-0.5 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
              ₱{kpis.todayProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Monthly Revenue</span>
          <h3 className="mt-1 font-mono text-lg font-bold text-foreground">₱{kpis.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-muted-foreground">Total volume sold</span>
        </Card>

        <Card className="border-l-4 border-l-red-400 p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-red-600 dark:text-red-400">Monthly COGS</span>
          <h3 className="mt-1 font-mono text-lg font-bold text-red-600 dark:text-red-400">₱{kpis.totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-muted-foreground">Recipe + direct costs</span>
        </Card>

        <Card className="border-l-4 border-l-sky-500 p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">Monthly Gross Profit</span>
          <h3 className="mt-1 font-mono text-lg font-bold text-sky-600 dark:text-sky-400">₱{kpis.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-muted-foreground">Revenue minus COGS</span>
        </Card>

        <Card className="border-l-4 border-l-amber-500 p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">Monthly OpEx</span>
          <h3 className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">₱{kpis.totalOpEx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-muted-foreground">Fixed operational bills</span>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Monthly Net Profit</span>
          <h3 className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">₱{kpis.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          <span className="text-[10px] text-muted-foreground">Clean cash remaining</span>
        </Card>

        <Card className="p-4">
          <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Net Profit Margin</span>
          <h3 className={`mt-1 font-mono text-lg font-bold ${kpis.profitMarginPercentage > 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {kpis.profitMarginPercentage.toFixed(1)}%
          </h3>
          <span className="text-[10px] text-muted-foreground">Target parameter {'>'} 20%</span>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Expenses Deducted This Month ({expensesBreakdown.length})
          </h3>
          <Link href="/sell/expenses" className="text-xs font-medium text-primary hover:underline">
            Manage expenses →
          </Link>
        </div>
        {expensesBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No operating expenses logged this month — net profit currently equals gross profit.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {expensesBreakdown.map((exp, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 text-xs dark:border-amber-900 dark:bg-amber-950/40">
                <div className="min-w-0">
                  <span className="block truncate font-bold text-foreground">{exp.title}</span>
                  {exp.description && <span className="block truncate text-[10px] text-muted-foreground">{exp.description}</span>}
                </div>
                <span className="shrink-0 font-mono font-bold text-amber-600 dark:text-amber-400">
                  -₱{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 text-xs font-bold font-mono uppercase tracking-wider text-foreground">Sales Timeline (7 days)</h3>
          <div className="relative h-64 w-full">
            <Line data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-xs font-bold font-mono uppercase tracking-wider text-foreground">Category Shares</h3>
          <div className="relative flex h-64 w-full items-center justify-center">
            {categoryShares.length === 0 ? (
              <span className="text-xs font-medium text-muted-foreground">No sales metrics recorded.</span>
            ) : (
              <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className={`p-5 ${meta.showMaterialsNav ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h3 className="mb-3 text-xs font-bold font-mono uppercase tracking-wider text-foreground">Product Volume &amp; Margins</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
                <TableHead className="p-3">Product</TableHead>
                <TableHead className="p-3 text-center">Units Sold</TableHead>
                <TableHead className="p-3 text-right">Revenue</TableHead>
                <TableHead className="p-3 text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="p-4 text-center text-muted-foreground">No checkout items logged this month.</TableCell></TableRow>
              ) : (
                topProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-3 font-bold text-foreground">{p.name}</TableCell>
                    <TableCell className="p-3 text-center font-mono">{p.qty} pcs</TableCell>
                    <TableCell className="p-3 text-right font-mono">₱{p.revenue.toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">₱{p.profit.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* A retail or services business has no bill-of-materials layer at
            all (see lib/business/type-meta.ts), so there's nothing
            meaningful to show here — these two panels are restaurant-only. */}
        {meta.showMaterialsNav && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-3 text-xs font-bold font-mono uppercase tracking-wider text-red-600 dark:text-red-400">Low Stock {meta.materialLabel} ({lowStockIngredients.length})</h3>
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {lowStockIngredients.length === 0 ? (
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> All raw {meta.materialLabel.toLowerCase()} safely buffered above trigger marks.
                </div>
              ) : (
                lowStockIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2.5 text-xs dark:border-red-900 dark:bg-red-950/40">
                    <span className="font-bold text-foreground">{ing.name}</span>
                    <span className="rounded border border-red-100 bg-background px-2 py-0.5 font-mono font-bold text-red-600 dark:border-red-900 dark:text-red-400">
                      {ing.current_stock} {unitLabel(ing.unit_type)} remaining (Alert @ {ing.min_stock_alert})
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-xs font-bold font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">{meta.materialLabel} Cost Matrix</h3>
            <div className="max-h-44 space-y-1.5 overflow-y-auto text-xs font-medium">
              {ingredientsCostList.map((ing, idx) => (
                <div key={idx} className="flex justify-between rounded p-2 transition-colors hover:bg-muted/50">
                  <span className="text-foreground">{ing.name}</span>
                  <span className="font-mono font-bold text-foreground">₱{ing.cost.toFixed(4)} / {unitLabel(ing.unit_type)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        )}
      </div>
    </div>
  )
}
