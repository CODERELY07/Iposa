import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import DynamicOfferingRequestForm from '@/components/offerings/DynamicOfferingRequestForm'
import ShareProductButton from '@/components/marketplace/ShareProductButton'
import { Badge } from '@/components/ui/badge'
import { submitServiceRequestAction, uploadServiceRequestFileAction } from './actions'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { MarketplaceOffering } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function ServiceOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; offeringSlug: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { slug, offeringSlug } = await params
  const { ref } = await searchParams
  const supabase = await createClient()

  // Mirrors checkout/page.tsx: submitting a request needs an authenticated
  // customer_id (submit_service_request() requires auth.uid()), so this
  // gates the whole page rather than letting an anonymous visitor fill out
  // the form only to fail on submit.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: offering } = await supabase
    .from('marketplace_offerings')
    .select('*')
    .eq('business_slug', slug)
    .eq('slug', offeringSlug)
    .eq('requires_pos', false)
    .maybeSingle<MarketplaceOffering>()

  if (!offering) {
    notFound()
  }

  // Same contract as the product page's affiliateCode/affiliateCommission:
  // only an approved affiliate gets a code-tagged share link, and only when
  // this offering's shop has actually set a service_commission_amount above
  // ₱0 — handing out a tagged link otherwise would earn nothing no matter
  // how many requests it drives, with no error or feedback anywhere.
  let affiliateCode: string | null = null
  let affiliateCommission: number | null = null
  const role = await getCurrentUserRole()
  if (role === 'affiliate') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const [{ data: affiliate }, { data: affiliateSettings }, { data: commissionValue }] = await Promise.all([
        supabase
          .from('affiliates')
          .select('code')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle(),
        supabase
          .from('business_affiliate_settings')
          .select('enabled')
          .eq('business_id', offering.business_id)
          .eq('enabled', true)
          .maybeSingle(),
        supabase.rpc('affiliate_service_commission', { p_offering_id: offering.id }),
      ])
      affiliateCode = affiliateSettings ? (affiliate?.code ?? null) : null
      affiliateCommission = commissionValue === null ? null : Number(commissionValue)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Browse</Link>
        <ChevronRight className="size-3" />
        <Link href={`/shop/${slug}`} className="hover:text-foreground">{offering.business_name}</Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-foreground">{offering.name}</span>
      </nav>

      <div className="mb-6 flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand-soft shadow-card">
          {offering.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offering.image_url} alt={offering.name} className="h-full w-full object-cover" />
          ) : (
            <Sparkles className="size-7 text-primary/50" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">{offering.name}</h1>
            <ShareProductButton path={`/shop/${slug}/service/${offeringSlug}`} refCode={affiliateCode} />
          </div>
          {offering.description && <p className="mt-1 text-sm text-muted-foreground">{offering.description}</p>}
          <p className="mt-1.5 text-lg font-bold text-foreground">
            {offering.price != null
              ? <>{offering.price_label ?? ''} ₱{Number(offering.price).toFixed(2)}</>
              : offering.price_label ?? 'Contact for a quote'}
          </p>
          {affiliateCommission !== null && (
            <Badge
              variant="outline"
              className={
                affiliateCommission > 0
                  ? 'mt-1.5 w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'mt-1.5 w-fit text-muted-foreground'
              }
            >
              {affiliateCommission > 0
                ? `You'll earn ₱${affiliateCommission.toFixed(2)} when this request is completed`
                : "This shop isn't paying a service commission — ₱0.00"}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <DynamicOfferingRequestForm
          offering={offering}
          refCode={ref ?? null}
          onSubmit={submitServiceRequestAction}
          onUploadFile={uploadServiceRequestFileAction}
        />
      </div>
    </div>
  )
}
