import { requireApprovedAffiliate, createClient } from '@/lib/supabase/server'
import type { AffiliateCommissionStatus } from '@/lib/types/marketplace'

export const revalidate = 0

const STATUS_STYLES: Record<AffiliateCommissionStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  paid: 'bg-blue-50 text-blue-700 border-blue-100',
  void: 'bg-red-50 text-red-700 border-red-100',
}

export default async function AffiliateCommissionsPage() {
  const affiliate = await requireApprovedAffiliate()
  const supabase = await createClient()

  const { data: commissions, error } = await supabase
    .from('affiliate_commissions')
    .select('id, order_id, referred_subtotal, commission_rate, commission_amount, status, created_at, businesses(name, slug)')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Commissions</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Every order referred through one of your links.</p>
      </div>

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          Failed to load commissions: {error.message}
        </div>
      ) : (commissions ?? []).length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white">
          No commissions yet — share your referral links to start earning.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 bg-zinc-50">
                <th className="p-3">Shop</th>
                <th className="p-3">Order</th>
                <th className="p-3 text-right">Referred Amount</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Commission</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-sm">
              {(commissions ?? []).map(c => {
                const business = Array.isArray(c.businesses) ? c.businesses[0] : c.businesses
                return (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition">
                    <td className="p-3 font-medium text-zinc-800">{business?.name ?? '—'}</td>
                    <td className="p-3 font-mono text-zinc-400 text-xs">#{c.order_id.slice(0, 8)}</td>
                    <td className="p-3 text-right font-mono">₱{Number(c.referred_subtotal).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">{Number(c.commission_rate).toFixed(2)}%</td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-600">₱{Number(c.commission_amount).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status as AffiliateCommissionStatus]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-zinc-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
