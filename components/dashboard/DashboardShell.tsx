'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

type DashboardShellProps = {
  role: 'admin' | 'staff'
  children: React.ReactNode
}

const adminNavItems = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/pos', label: 'POS', icon: '💳' },
  { href: '/analytics', label: 'Analytics', icon: '📈' },
]

const staffNavItems = [
  { href: '/pos', label: 'POS', icon: '💳' },
]

const adminManageItems = [
  { href: '/inventory/products', label: 'Products', icon: '📦' },
  { href: '/inventory/categories', label: 'Categories', icon: '🏷️' },
  { href: '/ingredients', label: 'Ingredients', icon: '🥘' },
  { href: '/sales-history', label: 'Sales History', icon: '📜' },
]

const staffManageItems = [
  { href: '/inventory/categories', label: 'Categories', icon: '🏷️' },
  { href: '/ingredients', label: 'Ingredients', icon: '🥘' },
  { href: '/sales-history', label: 'Sales History', icon: '📜' },
]

export default function DashboardShell({ role, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (href: string) => pathname.startsWith(href)

  const navItems = [
    {
      section: 'Main',
      items: role === 'admin' ? adminNavItems : staffNavItems,
    },
    {
      section: 'Manage',
      items: role === 'admin' ? adminManageItems : staffManageItems,
    },
  ]

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-40 w-56 shrink-0 bg-white border-r border-zinc-200 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-100">
          <Link href="/home" className="text-sm font-semibold text-zinc-900 tracking-tight hover:text-blue-600 transition">
            IPOSA
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-zinc-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          {navItems.map((section) => (
            <div key={section.section}>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-2 pt-3 pb-2">
                {section.section}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 transition-all duration-200
                      ${isActive(item.href)
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }
                    `}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-100">
          <Link
            href="/account/update-password"
            className="flex items-center gap-2.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg px-3 py-2 transition"
          >
            <span className="text-base">⚙️</span> Account
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
