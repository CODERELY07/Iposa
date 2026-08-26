import { redirect } from 'next/navigation'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import RegisterAffiliateForm from '@/components/marketplace/RegisterAffiliateForm'

export default async function BecomeAffiliatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/become-affiliate')
  }

  const role = await getCurrentUserRole()
  if (role === 'affiliate' || role === 'super_admin') {
    redirect('/affiliate')
  }

  return (
    <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-blue-700 mb-2">
        Affiliate Program
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Become an affiliate</h1>
      <p className="text-sm text-zinc-500 mb-7">
        Share referral links to shops on Iposa and earn a commission on every sale you bring in.
        Submit your details for review — once approved, you&apos;ll get your own dashboard and referral code.
      </p>
      <RegisterAffiliateForm />
    </div>
  )
}
