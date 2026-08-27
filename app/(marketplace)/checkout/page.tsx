import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from '@/components/marketplace/CheckoutForm'
import { Card } from '@/components/ui/card'
import { ClipboardCheck } from 'lucide-react'

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
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow-primary">
          <ClipboardCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            Items from different shops are placed as separate orders automatically.
          </p>
        </div>
      </div>
      <Card className="p-5">
        <CheckoutForm defaultName={profile?.full_name ?? ''} />
      </Card>
    </div>
  )
}
