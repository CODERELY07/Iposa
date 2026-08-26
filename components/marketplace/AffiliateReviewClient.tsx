'use client'

import { useState, useTransition } from 'react'
import { reviewAffiliateAction } from '@/app/admin/affiliates/actions'
import type { Affiliate } from '@/lib/types/marketplace'

export default function AffiliateReviewClient({ affiliates }: { affiliates: Affiliate[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function approve(id: string) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewAffiliateAction(id, 'approved')
      if (!result.success) setError(result.message)
      setBusyId(null)
    })
  }

  function reject(id: string) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewAffiliateAction(id, 'rejected', reason)
      if (!result.success) setError(result.message)
      setBusyId(null)
      setRejectingId(null)
      setReason('')
    })
  }

  const STATUS_STYLES: Record<Affiliate['status'], string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>
      )}

      {affiliates.length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No affiliate applications yet.
        </div>
      )}

      {affiliates.map(a => (
        <div key={a.id} className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900">{a.full_name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">Code: {a.code}</p>
              {a.payout_method && (
                <p className="text-sm text-zinc-600 mt-2">
                  {a.payout_method}{a.payout_details ? ` — ${a.payout_details}` : ''}
                </p>
              )}
              {a.status === 'rejected' && a.rejection_reason && (
                <p className="text-xs text-red-600 mt-2">Reason: {a.rejection_reason}</p>
              )}
              <p className="text-[11px] text-zinc-400 mt-2">
                Submitted {new Date(a.created_at).toLocaleString()}
              </p>
            </div>

            {a.status === 'pending' && (
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(a.id)}
                    disabled={isPending && busyId === a.id}
                    className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(rejectingId === a.id ? null : a.id)}
                    className="text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
                {rejectingId === a.id && (
                  <div className="flex gap-2 items-start w-64">
                    <input
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5"
                    />
                    <button
                      onClick={() => reject(a.id)}
                      disabled={isPending && busyId === a.id}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
