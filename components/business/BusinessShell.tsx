'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Business } from '@/lib/types/marketplace'
import SignOutButton from '@/components/auth/SignOutButton'

const navSections = [
  {
    section: 'Main',
    items: [
      { href: '/sell', label: 'Overview', icon: '🏠' },
      { href: '/sell/pos', label: 'POS', icon: '💳' },
    ],
  },
  {
    section: 'Catalog',
    items: [
      { href: '/sell/products', label: 'Products', icon: '📦' },
      { href: '/sell/categories', label: 'Categories', icon: '🏷️' },
      { href: '/sell/ingredients', label: 'Ingredients', icon: '🥘' },
    ],
  },
  {
    section: 'Sales',
    items: [
      { href: '/sell/orders', label: 'Online Orders', icon: '🧾' },
      { href: '/sell/sales-history', label: 'POS Sales History', icon: '📜' },
      { href: '/sell/analytics', label: 'Analytics', icon: '📈' },
    ],
  },
]

export default function BusinessShell({ business, children }: { business: Business; children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isActive = (href: string) => (href === '/sell' ? pathname === '/sell' : pathname.startsWith(href))

  return (
    <div className="h-screen flex flex-col md:flex-row bg-zinc-50 overflow-hidden">
      {/* Mobile-only top bar. Sits in normal document flow (not floating),
          so it never overlaps page content the way a fixed button would. */}
      <header className="md:hidden shrink-0 h-14 flex items-center gap-3 px-4 border-b border-zinc-200 bg-white">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900 truncate">{business.name}</span>
      </header>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-60 shrink-0 bg-white border-r border-zinc-200 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <Link href="/" className="text-sm font-semibold text-zinc-900 tracking-tight hover:text-blue-600 transition">
            IPOSA <span className="text-zinc-400 font-normal">Seller</span>
          </Link>
        </div>
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-bold text-zinc-900 truncate">{business.name}</p>
          <Link href={`/shop/${business.slug}`} className="text-[11px] text-blue-600 hover:underline">
            View my shop →
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          {navSections.map(section => (
            <div key={section.section}>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-2 pt-3 pb-2">
                {section.section}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-100 space-y-0.5">
          <Link
            href="/sell/settings"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 transition-all duration-200 ${
              isActive('/sell/settings')
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <span className="text-base">⚙️</span> Settings
          </Link>
          <Link
            href="/account/update-password"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg px-3 py-2 transition-all duration-200"
          >
            <span className="text-base">🔑</span> Password
          </Link>
          <SignOutButton
            icon={<span className="text-base">🚪</span>}
            className="w-full flex items-center gap-2.5 text-sm text-zinc-600 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition cursor-pointer disabled:opacity-50"
          />
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  )
}
