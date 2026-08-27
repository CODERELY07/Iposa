import { redirect } from 'next/navigation'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import RegisterAffiliateForm from '@/components/marketplace/RegisterAffiliateForm'
import AuthCard from '@/components/marketplace/AuthCard'

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
    <AuthCard
      eyebrow="Affiliate Program"
      title="Become an affiliate"
      description="Share referral links to shops on Iposa and earn a commission on every sale you bring in. Submit your details for review — once approved, you'll get your own dashboard and referral code."
    >
      <RegisterAffiliateForm />
    </AuthCard>
  )
}
