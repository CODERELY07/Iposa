import { redirect } from 'next/navigation'
import { requireBusinessAccount } from '@/lib/supabase/server'
import BusinessShell from '@/components/business/BusinessShell'

export default async function SellLayout({ children }: { children: React.ReactNode }) {
  const { role, business } = await requireBusinessAccount()

  // A super_admin has no storefront of their own — send them to the admin
  // area instead of a seller dashboard that doesn't apply to them.
  if (role === 'super_admin' && !business) {
    redirect('/admin/businesses')
  }

  if (!business) {
    redirect('/register-business')
  }

  return <BusinessShell business={business}>{children}</BusinessShell>
}
