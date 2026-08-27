import SalesHistoryClient from '@/components/business/SalesHistoryClient'
import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

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
      <Alert variant="destructive" className="mx-auto m-6 max-w-2xl">
        <AlertCircle />
        <AlertTitle>Failed to load sales history</AlertTitle>
        <AlertDescription>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-foreground p-3 font-mono text-[11px] text-background">
            {salesError.message}
          </pre>
        </AlertDescription>
      </Alert>
    )
  }

  return <SalesHistoryClient initialSales={salesRaw ?? []} />
}
