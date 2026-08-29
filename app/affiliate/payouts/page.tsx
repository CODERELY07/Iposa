import { requireApprovedAffiliate, createClient } from '@/lib/supabase/server'
import RequestPayoutButton from '@/components/affiliate/RequestPayoutButton'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PayoutStatusBadge } from '@/components/marketplace/StatusBadge'
import { AlertCircle, Landmark } from 'lucide-react'
import type { AffiliatePayoutStatus } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AffiliatePayoutsPage() {
  const affiliate = await requireApprovedAffiliate()
  const supabase = await createClient()

  const [{ data: payoutRows, error: payoutsErr }, { data: payableRows, error: payableErr }] = await Promise.all([
    supabase
      .from('affiliate_payouts')
      .select('id, amount, status, requested_at, paid_at, businesses(name, slug)')
      .eq('affiliate_id', affiliate.id)
      .order('requested_at', { ascending: false }),
    supabase
      .from('affiliate_commissions')
      .select('commission_amount')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'approved')
      .is('payout_id', null),
  ])

  const error = payoutsErr ?? payableErr
  const payableBalance = (payableRows ?? []).reduce((sum, r) => sum + Number(r.commission_amount), 0)
  const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Payouts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every sale here is cash, so every commission is paid the same way — in person, by the shop whose sale you
          referred. Requesting a payout splits your balance into one request per shop; each pays their own.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load payouts: {error.message}</AlertDescription>
        </Alert>
      )}

      <Card className="flex-col items-start justify-between gap-4 bg-gradient-brand-soft p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-card">
            <Landmark className="size-5" />
          </span>
          <div>
            <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Available to request</span>
            <h3 className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">{peso(payableBalance)}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Paid in cash, in person{affiliate.payout_details ? ` — reachable at ${affiliate.payout_details}` : ''}
            </p>
          </div>
        </div>
        <RequestPayoutButton disabled={payableBalance <= 0} />
      </Card>

      {(payoutRows ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <Landmark className="size-5 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No payout requests yet.</p>
        </div>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
                <TableHead className="p-3">Shop</TableHead>
                <TableHead className="p-3">Requested</TableHead>
                <TableHead className="p-3 text-right">Amount</TableHead>
                <TableHead className="p-3">Status</TableHead>
                <TableHead className="p-3">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payoutRows ?? []).map(p => {
                const business = Array.isArray(p.businesses) ? p.businesses[0] : p.businesses
                return (
                  <TableRow key={p.id}>
                    <TableCell className="p-3 font-medium text-foreground">{business?.name ?? '—'}</TableCell>
                    <TableCell className="p-3 text-xs text-muted-foreground">{new Date(p.requested_at).toLocaleString()}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-semibold text-foreground">{peso(Number(p.amount))}</TableCell>
                    <TableCell className="p-3"><PayoutStatusBadge status={p.status as AffiliatePayoutStatus} /></TableCell>
                    <TableCell className="p-3 text-xs text-muted-foreground">{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
