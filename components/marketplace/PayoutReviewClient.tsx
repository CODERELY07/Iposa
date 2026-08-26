'use client'

import { useState, useTransition } from 'react'
import { reviewPayoutAction } from '@/app/admin/payouts/actions'
import type { AffiliatePayout } from '@/lib/types/marketplace'

export default function PayoutReviewClient({ payouts }: { payouts: AffiliatePayout[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function review(id: string, status: 'paid' | 'rejected') {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewPayoutAction(id, status)
      if (!result.success) setError(result.message)
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      {payouts.length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No pending payout requests.
        </div>
      )}

      {payouts.map(p => (
        <div key={p.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-900">{p.affiliates?.full_name ?? 'Affiliate'}</h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Code: {p.affiliates?.code}</p>
            <p className="text-sm font-mono font-semibold text-zinc-900 mt-2">
              ₱{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">Requested {new Date(p.requested_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => review(p.id, 'paid')}
              disabled={isPending && busyId === p.id}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Mark paid
            </button>
            <button
              onClick={() => review(p.id, 'rejected')}
              disabled={isPending && busyId === p.id}
              className="text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
