import Link from 'next/link'
import { requireBusinessAccount, createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  Clock,
  XCircle,
  Package,
  Receipt,
  AlertTriangle,
  TrendingUp,
  PartyPopper,
} from 'lucide-react'

export const revalidate = 0

export default async function SellDashboardPage() {
  const { business } = await requireBusinessAccount()

  if (!business) {
    return null // layout already redirects this case
  }

  if (business.status === 'pending') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950">
          <Clock className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Your application is under review</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{business.name}</span> is waiting for approval
          from the marketplace team. You&apos;ll be able to manage products and orders once it&apos;s approved.
        </p>
      </div>
    )
  }

  if (business.status === 'rejected') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950">
          <XCircle className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Application not approved</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{business.name}</span> was not approved.
        </p>
        {business.rejection_reason && (
          <Alert variant="destructive" className="mt-2 w-fit">
            <AlertDescription>{business.rejection_reason}</AlertDescription>
          </Alert>
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
    // products derive live stock from ingredients instead (see Products/Analytics),
    // and untracked rows (services — always available) never count as "low stock".
    supabase
      .from('store_products')
      .select('id, name, sku, stock')
      .eq('business_id', business.id)
      .eq('track_stock', true)
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
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>
          Failed to calculate business metrics: {salesErr?.message ?? stockErr?.message ?? itemsErr?.message}
        </AlertDescription>
      </Alert>
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
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Welcome back, {business.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Here&apos;s how your business is doing.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">POS Revenue Today</span>
              <h3 className="mt-2 font-mono text-2xl font-bold text-foreground">
                ₱{totalRevenueToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">{totalTransactionsToday} transactions since midnight</p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="size-4 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Link href="/sell/products">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Products listed</span>
                <h3 className="mt-2 font-serif text-3xl font-normal text-foreground">{productCount ?? 0}</h3>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                <Package className="size-4 text-sky-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sell/orders">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Online orders awaiting action</span>
                <h3 className="mt-2 font-serif text-3xl font-normal text-foreground">{pendingOrderCount ?? 0}</h3>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <Receipt className="size-4 text-violet-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Low stock items</span>
              <h3 className="mt-2 font-serif text-3xl font-normal text-foreground">{lowStockProducts?.length ?? 0}</h3>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground">Top Moving Stock (POS)</h4>
            <p className="text-[11px] text-muted-foreground">Most frequent in-store products by units sold.</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            {sortedTopProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center text-xs text-muted-foreground">
                No POS sales recorded yet.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="label-mono border-b bg-gradient-brand-soft">
                    <th className="rounded-l-md p-2">Product</th>
                    <th className="p-2">SKU</th>
                    <th className="rounded-r-md p-2 text-right">Units Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {sortedTopProducts.map((p, index) => (
                    <tr key={index} className="transition-colors hover:bg-muted/50">
                      <td className="max-w-[220px] truncate p-2.5 font-medium text-foreground">{p.name}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">{p.sku}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-primary">{p.qty}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground">Low Stock Alerts</h4>
            <p className="text-[11px] text-muted-foreground">Standalone products under 10 units remaining.</p>
          </div>
          <div className="flex-1 overflow-x-auto">
            {(lowStockProducts ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-lg bg-emerald-50 py-12 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <PartyPopper className="size-5" />
                All products are fully stocked above the threshold.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="label-mono border-b bg-gradient-brand-soft">
                    <th className="rounded-l-md p-2">Product</th>
                    <th className="p-2">SKU</th>
                    <th className="rounded-r-md p-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {(lowStockProducts ?? []).map(p => (
                    <tr key={p.id} className="transition-colors hover:bg-muted/50">
                      <td className="max-w-[220px] truncate p-2.5 font-medium text-foreground">{p.name}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">{p.sku ?? 'N/A'}</td>
                      <td className="p-2.5 text-right font-semibold">
                        <Badge variant={p.stock === 0 ? 'destructive' : 'outline'} className={p.stock !== 0 ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400' : ''}>
                          {p.stock === 0 ? 'Out of Stock' : `${p.stock} units remaining`}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
