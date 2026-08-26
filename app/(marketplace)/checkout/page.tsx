import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from '@/components/marketplace/CheckoutForm'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold text-zinc-900 mb-1">Checkout</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Items from different shops are placed as separate orders automatically.
      </p>
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <CheckoutForm defaultName={profile?.full_name ?? ''} />
      </div>
    </div>
  )
}
