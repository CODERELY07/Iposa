import { requireAffiliateAccount, createClient } from '@/lib/supabase/server'
import LinkGenerator from '@/components/affiliate/LinkGenerator'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, XCircle, MousePointerClick, Receipt, Wallet, Landmark, Link2 } from 'lucide-react'
import type { MarketplaceProduct } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function AffiliateDashboardPage() {
  const { affiliate } = await requireAffiliateAccount()

  if (!affiliate) {
    return null // layout already redirects this case
  }

  if (affiliate.status === 'pending') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950">
          <Clock className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Your application is under review</h1>
        <p className="text-sm text-muted-foreground">
          Your affiliate application is waiting for approval from the marketplace team.
          You&apos;ll get your referral code and dashboard once it&apos;s approved.
        </p>
      </div>
    )
  }

  if (affiliate.status === 'rejected') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950">
          <XCircle className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Application not approved</h1>
        <p className="text-sm text-muted-foreground">Your affiliate application was not approved.</p>
        {affiliate.rejection_reason && (
          <Alert variant="destructive" className="mt-2 w-fit">
            <AlertDescription>{affiliate.rejection_reason}</AlertDescription>
          </Alert>
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
      <Alert variant="destructive" className="m-6">
        <AlertDescription>Failed to load affiliate data: {commissionsErr.message}</AlertDescription>
      </Alert>
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
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Welcome back, {affiliate.full_name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your referral code is <span className="font-mono font-semibold text-foreground">{affiliate.code}</span>.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex-row items-start justify-between p-5">
          <div>
            <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Link clicks</span>
            <h3 className="mt-2 font-serif text-3xl font-normal text-foreground">{clickCount ?? 0}</h3>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
            <MousePointerClick className="size-4 text-sky-600" />
          </div>
        </Card>
        <Card className="flex-row items-start justify-between p-5">
          <div>
            <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Orders referred</span>
            <h3 className="mt-2 font-serif text-3xl font-normal text-foreground">{ordersReferred}</h3>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
            <Receipt className="size-4 text-violet-600" />
          </div>
        </Card>
        <Card className="flex-row items-start justify-between p-5">
          <div>
            <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Payable earnings</span>
            <h3 className="mt-2 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">{peso(payableEarnings)}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{peso(pendingEarnings)} pending confirmation</p>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="size-4 text-primary" />
          </div>
        </Card>
        <Card className="flex-row items-start justify-between p-5">
          <div>
            <span className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground">Paid out</span>
            <h3 className="mt-2 font-mono text-2xl font-bold text-foreground">{peso(paidEarnings)}</h3>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Landmark className="size-4 text-amber-600" />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link2 className="size-4 text-primary" /> Share a product, earn a commission
        </h4>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Every product page on the marketplace has a Share button — while you&apos;re signed in it copies a link
          tagged with your code. You&apos;re only credited when the shopper adds <em>that</em> product to cart or
          buys it directly from that page; just visiting (or going back without acting) earns nothing. Here are
          the newest products from shops with the affiliate program turned on, as a shortcut:
        </p>
        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shops have enabled the affiliate program yet — check back soon.</p>
        ) : (
          <LinkGenerator code={affiliate.code} links={links} />
        )}
      </Card>
    </div>
  )
}
