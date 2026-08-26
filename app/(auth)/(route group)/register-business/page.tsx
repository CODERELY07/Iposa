import { redirect } from 'next/navigation'
import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import RegisterBusinessForm from '@/components/marketplace/RegisterBusinessForm'

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
    <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 mb-2">
        Sell on Iposa
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Register your shop</h1>
      <p className="text-sm text-zinc-500 mb-7">
        Submit your storefront for review. Once approved, you can manage products and orders.
      </p>
      <RegisterBusinessForm />
    </div>
  )
}
