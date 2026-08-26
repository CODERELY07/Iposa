import Link from 'next/link'
import { requireSuperAdmin } from '@/lib/supabase/server'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/admin/businesses" className="text-sm font-bold text-zinc-900 tracking-tight shrink-0">
            IPOSA <span className="text-blue-600">Admin</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium text-zinc-600 overflow-x-auto">
            <Link href="/admin/businesses" className="hover:text-zinc-900 transition whitespace-nowrap">
              <span className="sm:hidden">Applications</span>
              <span className="hidden sm:inline">Business Applications</span>
            </Link>
            <Link href="/" className="hover:text-zinc-900 transition whitespace-nowrap">Marketplace</Link>
            <SignOutButton className="text-xs font-semibold text-zinc-500 hover:text-red-600 transition cursor-pointer disabled:opacity-50 whitespace-nowrap" />
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
