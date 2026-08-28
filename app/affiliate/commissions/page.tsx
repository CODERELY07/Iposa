import { requireApprovedAffiliate, createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CommissionStatusBadge } from '@/components/marketplace/StatusBadge'
import { AlertCircle, Wallet } from 'lucide-react'
import type { AffiliateCommissionStatus } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AffiliateCommissionsPage() {
  const affiliate = await requireApprovedAffiliate()
  const supabase = await createClient()

  const { data: commissions, error } = await supabase
    .from('affiliate_commissions')
    .select('id, order_id, referred_subtotal, referred_profit, commission_rate, commission_amount, status, created_at, businesses(name, slug)')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Commissions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Every order referred through one of your links.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Failed to load commissions: {error.message}</AlertDescription>
        </Alert>
      ) : (commissions ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <Wallet className="size-5 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No commissions yet — share your referral links to start earning.</p>
        </div>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
                <TableHead className="p-3">Shop</TableHead>
                <TableHead className="p-3">Order</TableHead>
                <TableHead className="p-3 text-right">Referred Revenue</TableHead>
                <TableHead className="p-3 text-right">Referred Profit</TableHead>
                <TableHead className="p-3 text-right">Rate</TableHead>
                <TableHead className="p-3 text-right">Commission</TableHead>
                <TableHead className="p-3">Status</TableHead>
                <TableHead className="p-3">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(commissions ?? []).map(c => {
                const business = Array.isArray(c.businesses) ? c.businesses[0] : c.businesses
                return (
                  <TableRow key={c.id}>
                    <TableCell className="p-3 font-medium text-foreground">{business?.name ?? '—'}</TableCell>
                    <TableCell className="p-3 font-mono text-xs text-muted-foreground">#{c.order_id.slice(0, 8)}</TableCell>
                    <TableCell className="p-3 text-right font-mono">₱{Number(c.referred_subtotal).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono">₱{Number(c.referred_profit).toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono">{Number(c.commission_rate).toFixed(2)}%</TableCell>
                    <TableCell className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">₱{Number(c.commission_amount).toFixed(2)}</TableCell>
                    <TableCell className="p-3"><CommissionStatusBadge status={c.status as AffiliateCommissionStatus} /></TableCell>
                    <TableCell className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
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
