import SalesHistoryClient from '@/components/sales/SalesHistoryClient'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function SalesHistoryPage() {
  const supabase = await createClient()

  // Execute nested relational queries for sales metrics tracking
  const { data: salesRaw, error: salesError } = await supabase
    .from('sales')
    .select(`
      id,
      total,
      payment,
      change,
      created_at,
      created_by
    `)
    .order('created_at', { ascending: false })

  if (salesError) {
    console.error("Critical Sales Pipeline Failure Dump:", salesError.message)
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl border border-red-100 max-w-2xl mx-auto shadow-sm">
        <h3 className="font-bold text-base mb-1">POS Historical Engine Data Calculation Error</h3>
        <p className="text-xs text-red-500 font-medium mb-3">Failed to extract architectural structural data maps. Details:</p>
        <pre className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre-wrap">
          {salesError.message || "Null payload constraint error."}
        </pre>
      </div>
    )
  }

  return (
    <SalesHistoryClient 
      initialSales={salesRaw ?? []} 
    />
  )
}