import { requireApprovedBusiness, createClient } from '@/lib/supabase/server'
import BusinessSettingsForm from '@/components/marketplace/BusinessSettingsForm'
import BusinessLocationForm from '@/components/marketplace/BusinessLocationForm'
import AffiliateSettingsForm from '@/components/marketplace/AffiliateSettingsForm'
import ManagerPinForm from '@/components/business/ManagerPinForm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import { Store, MapPinned, Link2, KeyRound } from 'lucide-react'
import type { BusinessAffiliateSettings } from '@/lib/types/marketplace'

export const revalidate = 0

export default async function SellSettingsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { data: affiliateSettings } = await supabase
    .from('business_affiliate_settings')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle<BusinessAffiliateSettings>()

  const typeMeta = getBusinessTypeMeta(business.business_type)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Shop Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Update how your shop appears on the marketplace.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-violet),transparent_88%)] text-primary">
            <Store className="size-4" />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Storefront</CardTitle>
              <span className="label-mono rounded-full bg-gradient-brand-soft px-2 py-0.5 text-primary">{typeMeta.shortLabel}</span>
            </div>
            <CardDescription>Name, description, and branding shown to customers.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-snug text-muted-foreground">
            Registered as a <span className="font-medium text-foreground">{typeMeta.label}</span> — {typeMeta.costingSummary}
          </p>
          <BusinessSettingsForm business={business} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-pink),transparent_88%)] text-[color:var(--brand-pink)]">
            <MapPinned className="size-4" />
          </span>
          <div>
            <CardTitle>Pickup Location</CardTitle>
            <CardDescription>Where customers pick up a &apos;pickup&apos; order from — shown on their order once placed.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <BusinessLocationForm business={business} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-teal),transparent_88%)] text-[color:var(--brand-teal)]">
            <Link2 className="size-4" />
          </span>
          <div>
            <CardTitle>Affiliate Program</CardTitle>
            <CardDescription>Let affiliates earn a commission for sales they refer to your shop.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <AffiliateSettingsForm settings={affiliateSettings ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--brand-amber),transparent_88%)] text-[color:var(--brand-amber)]">
            <KeyRound className="size-4" />
          </span>
          <div>
            <CardTitle>POS Security PIN</CardTitle>
            <CardDescription>Required to void a transaction in POS Sales History.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ManagerPinForm />
        </CardContent>
      </Card>
    </div>
  )
}
