import { requireApprovedBusiness, createClient } from '@/lib/supabase/server'
import BusinessSettingsForm from '@/components/marketplace/BusinessSettingsForm'
import AffiliateSettingsForm from '@/components/marketplace/AffiliateSettingsForm'
import ManagerPinForm from '@/components/business/ManagerPinForm'
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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Shop Settings</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Update how your shop appears on the marketplace.</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <BusinessSettingsForm business={business} />
      </div>

      <div>
        <h2 className="text-base font-bold text-zinc-900">Affiliate Program</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Let affiliates earn a commission for sales they refer to your shop.</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <AffiliateSettingsForm settings={affiliateSettings ?? null} />
      </div>

      <div>
        <h2 className="text-base font-bold text-zinc-900">POS Security PIN</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Required to void a transaction in POS Sales History.</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <ManagerPinForm />
      </div>
    </div>
  )
}
