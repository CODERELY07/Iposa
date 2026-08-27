'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Affiliate } from '@/lib/types/marketplace'
import SignOutButton from '@/components/auth/SignOutButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidebarNavLink, type NavColor } from '@/components/dashboard/sidebar-nav'
import {
  LayoutDashboard,
  Wallet,
  Landmark,
  KeyRound,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; color: NavColor }[] = [
  { href: '/affiliate', label: 'Overview', icon: LayoutDashboard, color: 'emerald' },
  { href: '/affiliate/commissions', label: 'Commissions', icon: Wallet, color: 'amber' },
  { href: '/affiliate/payouts', label: 'Payouts', icon: Landmark, color: 'sky' },
]

const COLLAPSE_KEY = 'iposa.affiliate.sidebar.collapsed'

export default function AffiliateShell({ affiliate, children }: { affiliate: Affiliate; children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isActive = (href: string) => (href === '/affiliate' ? pathname === '/affiliate' : pathname.startsWith(href))
  // See BusinessShell for why the mobile drawer needs this forced false.
  const effectiveCollapsed = collapsed && !sidebarOpen

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      // storage unavailable — default to expanded
    }
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable — preference just won't persist
      }
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40 md:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          <Menu />
        </Button>
        <span className="truncate text-sm font-semibold text-foreground">{affiliate.full_name}</span>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out md:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-16' : 'md:w-64'}`}
      >
        <div className={`flex h-14 items-center border-b ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          <Link href="/" className={`flex min-w-0 items-center gap-2 ${collapsed ? 'md:hidden' : ''}`}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary">
              <PackageSearch className="size-4" />
            </span>
            <span className="truncate font-serif text-base leading-none tracking-tight text-foreground transition-colors hover:text-primary" title="MElocalmarketplace Affiliate">
              MElocalmarketplace <span className="font-sans text-sm font-normal text-muted-foreground">Affiliate</span>
            </span>
          </Link>
          {collapsed && (
            <span className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary md:flex">
              <PackageSearch className="size-4" />
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden shrink-0 md:inline-flex"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>

        <div className={`px-4 pb-2 pt-4 ${collapsed ? 'md:hidden' : ''}`}>
          <p className="truncate text-sm font-bold text-foreground">{affiliate.full_name}</p>
          <Badge variant="secondary" className="mt-1 font-mono">{affiliate.code}</Badge>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {navItems.map(item => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              color={item.color}
              active={isActive(item.href)}
              collapsed={effectiveCollapsed}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="space-y-0.5 border-t p-3">
          {effectiveCollapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/account/update-password"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  />
                }
              >
                <KeyRound className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">Password</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/account/update-password"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <KeyRound className="size-4" /> Password
            </Link>
          )}
          {effectiveCollapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <SignOutButton
                    icon={<LogOut className="size-4" />}
                    hideLabel
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  />
                }
              />
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <SignOutButton
              icon={<LogOut className="size-4" />}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            />
          )}
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
