import { redirect } from 'next/navigation'
import { requireAffiliateAccount } from '@/lib/supabase/server'
import AffiliateShell from '@/components/affiliate/AffiliateShell'

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const { role, affiliate } = await requireAffiliateAccount()

  // A super_admin has no affiliate profile of their own — send them to the
  // admin area instead of an affiliate dashboard that doesn't apply to them.
  if (role === 'super_admin' && !affiliate) {
    redirect('/admin/affiliates')
  }

  if (!affiliate) {
    redirect('/become-affiliate')
  }

  return <AffiliateShell affiliate={affiliate}>{children}</AffiliateShell>
}
