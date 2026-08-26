'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/lib/marketplace/cart-context'
import SignOutButton from '@/components/auth/SignOutButton'
import type { UserRole } from '@/lib/supabase/server'

type Props = {
  userEmail: string | null
  role: UserRole | null
}

export default function MarketplaceHeader({ userEmail, role }: Props) {
  const { totalItems } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = (
    <>
      <Link href="/" onClick={() => setMenuOpen(false)} className="hover:text-zinc-900 transition">Browse</Link>
      {userEmail && (
        <Link href="/orders" onClick={() => setMenuOpen(false)} className="hover:text-zinc-900 transition">My Orders</Link>
      )}
      {role === 'business_admin' && (
        <Link href="/sell" onClick={() => setMenuOpen(false)} className="hover:text-zinc-900 transition">My Store</Link>
      )}
      {role === 'super_admin' && (
        <Link href="/admin/businesses" onClick={() => setMenuOpen(false)} className="hover:text-zinc-900 transition">Admin</Link>
      )}
      {(role === null || role === 'customer') && (
        <Link href="/register-business" onClick={() => setMenuOpen(false)} className="hover:text-zinc-900 transition">Sell on Iposa</Link>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="sm:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <Link href="/" className="text-lg font-bold text-zinc-900 tracking-tight">
            IPOSA <span className="text-blue-600 hidden sm:inline">Marketplace</span>
          </Link>
        </div>

        <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-zinc-600">
          {navLinks}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/cart"
            className="relative flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 transition"
          >
            🛒 Cart
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>

          {userEmail ? (
            <SignOutButton
              redirectTo="/"
              className="hidden sm:inline text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition cursor-pointer disabled:opacity-50"
            />
          ) : (
            <Link
              href="/login"
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav className="sm:hidden border-t border-zinc-100 px-4 py-3 flex flex-col gap-3 text-sm font-medium text-zinc-600 bg-white">
          {navLinks}
          {userEmail && (
            <SignOutButton
              redirectTo="/"
              className="text-left text-red-600 hover:text-red-700 transition cursor-pointer disabled:opacity-50"
            />
          )}
        </nav>
      )}
    </header>
  )
}
