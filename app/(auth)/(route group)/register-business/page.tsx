import { redirect } from 'next/navigation'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import RegisterBusinessForm from '@/components/marketplace/RegisterBusinessForm'
import AuthCard from '@/components/marketplace/AuthCard'

export default async function RegisterBusinessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/register-business')
  }

  const role = await getCurrentUserRole()
  if (role === 'business_admin' || role === 'super_admin') {
    redirect('/sell')
  }

  return (
    <AuthCard
      eyebrow="Sell on MElocalmarketplace"
      title="Register your shop"
      description="Submit your storefront for review. Once approved, you can manage products and orders."
      className="max-w-2xl"
    >
      <RegisterBusinessForm />
    </AuthCard>
  )
}
