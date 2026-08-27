import Link from 'next/link'
import { requireSuperAdmin } from '@/lib/supabase/server'
import SignOutButton from '@/components/auth/SignOutButton'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Store, Link2, Landmark } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin()

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/admin/businesses" className="flex min-w-0 shrink items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary">
              <ShieldCheck className="size-4" />
            </span>
            <span className="truncate font-serif text-lg leading-none tracking-tight text-foreground">
              MElocalmarketplace <Badge variant="secondary" className="label-mono align-middle">Admin</Badge>
            </span>
          </Link>
          <nav className="flex items-center gap-3 overflow-x-auto text-xs font-medium text-muted-foreground sm:gap-4 sm:text-sm">
            <Link href="/admin/businesses" className="flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground">
              <Store className="size-3.5 text-sky-600 dark:text-sky-400" />
              <span className="sm:hidden">Businesses</span>
              <span className="hidden sm:inline">Business Applications</span>
            </Link>
            <Link href="/admin/affiliates" className="flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground">
              <Link2 className="size-3.5 text-violet-600 dark:text-violet-400" />
              <span className="sm:hidden">Affiliates</span>
              <span className="hidden sm:inline">Affiliate Applications</span>
            </Link>
            <Link href="/admin/payouts" className="flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground">
              <Landmark className="size-3.5 text-amber-600 dark:text-amber-400" /> Payouts
            </Link>
            <Link href="/" className="whitespace-nowrap transition-colors hover:text-foreground">Marketplace</Link>
            <SignOutButton className="whitespace-nowrap text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50" />
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
