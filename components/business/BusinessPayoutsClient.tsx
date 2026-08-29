'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { reviewBusinessPayoutAction } from '@/app/sell/affiliate-payouts/actions'
import type { AffiliatePayout } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Landmark, Phone } from 'lucide-react'

export default function BusinessPayoutsClient({ payouts }: { payouts: AffiliatePayout[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function review(id: string, status: 'paid' | 'rejected') {
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewBusinessPayoutAction(id, status)
      if (!result.success) toast.error(result.message)
      else toast.success(status === 'paid' ? 'Marked paid.' : 'Rejected.')
      setBusyId(null)
    })
  }

  const pending = payouts.filter(p => p.status === 'requested')
  const resolved = payouts.filter(p => p.status !== 'requested')

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {pending.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
              <Landmark className="size-5 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">No pending payout requests.</p>
          </div>
        )}

        {pending.map(p => (
          <Card key={p.id} className="flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">{p.affiliates?.full_name ?? 'Affiliate'}</h3>
              <Badge variant="outline" className="mt-1 font-mono">{p.affiliates?.code}</Badge>
              <p className="mt-2 font-mono text-lg font-bold text-foreground">
                ₱{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-1.5 font-sans text-[11px] font-normal text-muted-foreground">owed in cash</span>
              </p>
              {p.affiliates?.payout_details && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3" /> {p.affiliates.payout_details}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Requested {new Date(p.requested_at).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={isPending && busyId === p.id} onClick={() => review(p.id, 'paid')}>
                I paid this in cash
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isPending && busyId === p.id} onClick={() => review(p.id, 'rejected')}>
                Dispute / reject
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {resolved.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">Past requests</h2>
          <div className="space-y-2">
            {resolved.map(p => (
              <Card key={p.id} className="flex-row items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{p.affiliates?.full_name ?? 'Affiliate'}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">₱{Number(p.amount).toFixed(2)}</span>
                </div>
                <Badge variant={p.status === 'paid' ? 'default' : 'secondary'} className="shrink-0 font-mono uppercase tracking-wider">
                  {p.status}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
