import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DynamicOfferingRequestForm from '@/components/offerings/DynamicOfferingRequestForm'
import { submitServiceRequestAction, uploadServiceRequestFileAction } from './actions'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { MarketplaceOffering } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function ServiceOfferingPage({
  params,
}: {
  params: Promise<{ slug: string; offeringSlug: string }>
}) {
  const { slug, offeringSlug } = await params
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
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">{offering.name}</h1>
          {offering.description && <p className="mt-1 text-sm text-muted-foreground">{offering.description}</p>}
          <p className="mt-1.5 text-lg font-bold text-foreground">
            {offering.price != null
              ? <>{offering.price_label ?? ''} ₱{Number(offering.price).toFixed(2)}</>
              : offering.price_label ?? 'Contact for a quote'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <DynamicOfferingRequestForm
          offering={offering}
          onSubmit={submitServiceRequestAction}
          onUploadFile={uploadServiceRequestFileAction}
        />
      </div>
    </div>
  )
}
