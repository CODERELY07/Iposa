import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Inventory' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <span className="text-sm font-semibold text-zinc-900 tracking-tight">Inventory</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-2 pt-2 pb-1">
            Manage
          </p>
          <Link
            href="/inventory/products"
            className="flex items-center gap-2.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg px-3 py-2 transition"
          >
            <span className="text-base">📦</span> Products
          </Link>
          <Link
            href="/inventory/categories"
            className="flex items-center gap-2.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg px-3 py-2 transition"
          >
            <span className="text-base">🏷️</span> Categories
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}