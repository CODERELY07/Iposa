import SalesHistoryClient from '@/components/business/SalesHistoryClient'
import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'

export const revalidate = 0

export default async function SellSalesHistoryPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { data: salesRaw, error: salesError } = await supabase
    .from('sales')
    .select('id, total, payment, change, created_at, created_by')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (salesError) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl border border-red-100 max-w-2xl mx-auto shadow-sm">
        <h3 className="font-bold text-base mb-1">Failed to load sales history</h3>
        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre-wrap">
          {salesError.message}
        </pre>
      </div>
    )
  }

  return <SalesHistoryClient initialSales={salesRaw ?? []} />
}
