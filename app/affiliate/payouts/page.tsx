import { requireApprovedAffiliate, createClient } from '@/lib/supabase/server'
import RequestPayoutButton from '@/components/affiliate/RequestPayoutButton'
import type { AffiliatePayoutStatus } from '@/lib/types/marketplace'

export const revalidate = 0

const STATUS_STYLES: Record<AffiliatePayoutStatus, string> = {
  requested: 'bg-amber-50 text-amber-700 border-amber-100',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-red-50 text-red-700 border-red-100',
}

export default async function AffiliatePayoutsPage() {
  const affiliate = await requireApprovedAffiliate()
  const supabase = await createClient()

  const [{ data: payoutRows, error: payoutsErr }, { data: payableRows, error: payableErr }] = await Promise.all([
    supabase
      .from('affiliate_payouts')
      .select('id, amount, status, requested_at, paid_at')
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Payouts</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Cash out your payable balance to your registered payout method.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load payouts: {error.message}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Available to request</span>
          <h3 className="text-2xl font-mono font-bold text-emerald-600 mt-1">{peso(payableBalance)}</h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            Paid via {affiliate.payout_method ?? 'your registered method'}{affiliate.payout_details ? ` — ${affiliate.payout_details}` : ''}
          </p>
        </div>
        <RequestPayoutButton disabled={payableBalance <= 0} />
      </div>

      {(payoutRows ?? []).length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No payout requests yet.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                <th className="p-3">Requested</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-sm">
              {(payoutRows ?? []).map(p => (
                <tr key={p.id} className="hover:bg-zinc-50/50 transition">
                  <td className="p-3 text-xs text-zinc-500">{new Date(p.requested_at).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono font-semibold text-zinc-900">{peso(Number(p.amount))}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[p.status as AffiliatePayoutStatus]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-zinc-400">{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
