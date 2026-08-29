'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { reviewPayoutAction } from '@/app/admin/payouts/actions'
import type { AffiliatePayout } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Landmark } from 'lucide-react'

export default function PayoutReviewClient({ payouts }: { payouts: AffiliatePayout[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function review(id: string, status: 'paid' | 'rejected') {
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewPayoutAction(id, status)
      if (!result.success) toast.error(result.message)
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-4">
      {payouts.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <Landmark className="size-5 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No pending payout requests.</p>
        </div>
      )}

      {payouts.map(p => {
        const business = Array.isArray(p.businesses) ? p.businesses[0] : p.businesses
        return (
          <Card key={p.id} className="flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">{p.affiliates?.full_name ?? 'Affiliate'}</h3>
              <Badge variant="outline" className="mt-1 font-mono">{p.affiliates?.code}</Badge>
              <p className="mt-2 font-mono text-sm font-semibold text-foreground">
                ₱{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Owed by {business?.name ?? 'an unknown shop'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Requested {new Date(p.requested_at).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={isPending && busyId === p.id} onClick={() => review(p.id, 'paid')}>
                Mark paid
              </Button>
              <Button size="sm" variant="destructive" disabled={isPending && busyId === p.id} onClick={() => review(p.id, 'rejected')}>
                Reject
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
