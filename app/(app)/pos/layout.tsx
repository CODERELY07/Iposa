import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Inventory' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}