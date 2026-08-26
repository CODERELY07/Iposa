import { requireAffiliateAccount, createClient } from '@/lib/supabase/server'
import LinkGenerator from '@/components/affiliate/LinkGenerator'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AffiliateDashboardPage() {
  const { affiliate } = await requireAffiliateAccount()

  if (!affiliate) {
    return null // layout already redirects this case
  }

  if (affiliate.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-4xl mb-3">⏳</p>
        <h1 className="text-xl font-bold text-zinc-900">Your application is under review</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Your affiliate application is waiting for approval from the marketplace team.
          You&apos;ll get your referral code and dashboard once it&apos;s approved.
        </p>
      </div>
    )
  }

  if (affiliate.status === 'rejected') {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-4xl mb-3">✕</p>
        <h1 className="text-xl font-bold text-zinc-900">Application not approved</h1>
        <p className="text-sm text-zinc-500 mt-2">Your affiliate application was not approved.</p>
        {affiliate.rejection_reason && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mt-4 inline-block">
            {affiliate.rejection_reason}
          </p>
        )}
      </div>
    )
  }

  const supabase = await createClient()

  const [
    { count: clickCount },
    { data: commissions, error: commissionsErr },
    { data: enabledBusinessRows },
  ] = await Promise.all([
    supabase.from('affiliate_clicks').select('*', { count: 'exact', head: true }).eq('affiliate_id', affiliate.id),
    supabase.from('affiliate_commissions').select('status, commission_amount').eq('affiliate_id', affiliate.id),
    supabase.from('business_affiliate_settings').select('business_id').eq('enabled', true),
  ])

  if (commissionsErr) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to load affiliate data: {commissionsErr.message}
      </div>
    )
  }

  const enabledBusinessIds = (enabledBusinessRows ?? []).map(r => r.business_id)
  let shareableProducts: MarketplaceProduct[] = []
  if (enabledBusinessIds.length > 0) {
    const { data } = await supabase
      .from('marketplace_products')
      .select('*')
      .in('business_id', enabledBusinessIds)
      .order('created_at', { ascending: false })
      .limit(12)
    shareableProducts = (data as MarketplaceProduct[]) ?? []
  }

  const rows = commissions ?? []
  const ordersReferred = rows.length
  const sumBy = (status: string) => rows.filter(r => r.status === status).reduce((sum, r) => sum + Number(r.commission_amount), 0)
  const pendingEarnings = sumBy('pending')
  const payableEarnings = sumBy('approved')
  const paidEarnings = sumBy('paid')

  const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const links = shareableProducts.map(p => ({
    label: `${p.name} — ${p.business_name}`,
    path: `/shop/${p.business_slug}/${p.slug}`,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Welcome back, {affiliate.full_name}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Your referral code is <span className="font-mono font-semibold text-zinc-700">{affiliate.code}</span>.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Link clicks</span>
          <h3 className="text-2xl font-bold text-zinc-900 mt-2">{clickCount ?? 0}</h3>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Orders referred</span>
          <h3 className="text-2xl font-bold text-zinc-900 mt-2">{ordersReferred}</h3>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payable earnings</span>
          <h3 className="text-2xl font-mono font-bold text-emerald-600 mt-2">{peso(payableEarnings)}</h3>
          <p className="text-[11px] text-zinc-400 mt-1">{peso(pendingEarnings)} pending confirmation</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Paid out</span>
          <h3 className="text-2xl font-mono font-bold text-zinc-900 mt-2">{peso(paidEarnings)}</h3>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-zinc-900 mb-1">Share a product, earn a commission</h4>
        <p className="text-[11px] text-zinc-400 mb-3">
          Every product page on the marketplace has a 🔗 Share icon — while you&apos;re signed in it copies a link
          tagged with your code. You&apos;re only credited when the shopper adds <em>that</em> product to cart or
          buys it directly from that page; just visiting (or going back without acting) earns nothing. Here are
          the newest products from shops with the affiliate program turned on, as a shortcut:
        </p>
        {links.length === 0 ? (
          <p className="text-xs text-zinc-400">No shops have enabled the affiliate program yet — check back soon.</p>
        ) : (
          <LinkGenerator code={affiliate.code} links={links} />
        )}
      </div>
    </div>
  )
}
