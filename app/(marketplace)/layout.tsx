import { createClient, getCurrentUserRole } from '@/lib/supabase/server'
import { CartProvider } from '@/lib/marketplace/cart-context'
import MarketplaceHeader from '@/components/marketplace/MarketplaceHeader'
import MarketplaceFooter from '@/components/marketplace/MarketplaceFooter'

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = user ? await getCurrentUserRole() : null

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-zinc-50">
        <MarketplaceHeader userEmail={user?.email ?? null} role={role} />
        <main className="flex-1">{children}</main>
        <MarketplaceFooter />
      </div>
    </CartProvider>
  )
}
