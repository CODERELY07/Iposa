import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageSearch } from 'lucide-react'

export const metadata: Metadata = { title: 'Iposa' }

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/40 p-6">
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-[color-mix(in_oklch,var(--brand-violet),transparent_78%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-[color-mix(in_oklch,var(--brand-pink),transparent_82%)] blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-0 size-64 rounded-full bg-[color-mix(in_oklch,var(--brand-amber),transparent_88%)] blur-3xl" />
      <Link href="/" className="group relative mb-6 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary transition-transform group-hover:scale-105">
          <PackageSearch className="size-4.5" />
        </span>
        <span className="font-serif text-2xl leading-none tracking-tight text-foreground">Iposa</span>
      </Link>
      <div className="relative flex w-full flex-col items-center">{children}</div>
    </div>
  )
}
