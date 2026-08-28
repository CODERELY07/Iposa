import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import ExpensesClient from '@/components/business/ExpensesClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Wallet } from 'lucide-react'

export const revalidate = 0

export default async function SellExpensesPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { data: expenses, error } = await supabase
    .from('operating_expenses')
    .select('*')
    .eq('business_id', business.id)
    .order('billing_period', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to fetch expenses: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--brand-amber),transparent_88%)] text-[color:var(--brand-amber)]">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Log fixed operating bills — rent, utilities, staff, subscriptions. Anything billed within the current
            calendar month is deducted automatically from your Analytics net profit.
          </p>
        </div>
      </div>

      <ExpensesClient businessId={business.id} initialExpenses={expenses ?? []} />
    </div>
  )
}
