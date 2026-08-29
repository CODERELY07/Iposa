'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Business } from '@/lib/types/marketplace'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import SignOutButton from '@/components/auth/SignOutButton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidebarNavLink, type NavColor } from '@/components/dashboard/sidebar-nav'
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Tag,
  Soup,
  Receipt,
  ScrollText,
  LineChart,
  Wallet,
  Landmark,
  Settings,
  KeyRound,
  LogOut,
  Menu,
  PackageSearch,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; color: NavColor }

// Ingredients only appears for business types that actually use a
// bill-of-materials — a retail or services business has nothing to build a
// recipe out of (see lib/business/type-meta.ts), so that item is entirely
// conditional on the business's own type instead of one fixed nav for every
// shop. The Products/Services item itself always appears, just relabeled.
function getNavSections(business: Business): { section: string; items: NavItem[] }[] {
  const meta = getBusinessTypeMeta(business.business_type)

  return [
    {
      section: 'Main',
      items: [
        { href: '/sell', label: 'Overview', icon: LayoutDashboard, color: 'emerald' },
        { href: '/sell/pos', label: 'POS', icon: CreditCard, color: 'sky' },
      ],
    },
    {
      section: 'Catalog',
      items: [
        { href: '/sell/products', label: meta.catalogLabel, icon: Package, color: 'violet' },
        { href: '/sell/categories', label: 'Categories', icon: Tag, color: 'amber' },
        ...(meta.showMaterialsNav
          ? [{
              href: '/sell/ingredients',
              label: meta.materialLabel,
              icon: Soup,
              color: 'rose' as NavColor,
            }]
          : []),
      ],
    },
    {
      section: 'Sales',
      items: [
        { href: '/sell/orders', label: 'Online Orders', icon: Receipt, color: 'indigo' },
        { href: '/sell/sales-history', label: 'POS Sales History', icon: ScrollText, color: 'teal' },
        { href: '/sell/analytics', label: 'Analytics', icon: LineChart, color: 'fuchsia' },
        { href: '/sell/expenses', label: 'Expenses', icon: Wallet, color: 'amber' },
        // Every sale is cash, so an affiliate commission is cash this shop
        // itself owes and hands over in person — never a platform payout —
        // hence this lives in the shop's own nav, not just an admin page.
        { href: '/sell/affiliate-payouts', label: 'Affiliate Payouts', icon: Landmark, color: 'slate' },
      ],
    },
  ]
}

const COLLAPSE_KEY = 'iposa.sell.sidebar.collapsed'

export default function BusinessShell({ business, children }: { business: Business; children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isActive = (href: string) => (href === '/sell' ? pathname === '/sell' : pathname.startsWith(href))
  const navSections = getNavSections(business)
  const typeMeta = getBusinessTypeMeta(business.business_type)
  // The mobile drawer must always show the full nav regardless of the
  // desktop collapse preference — it's only ever open on mobile, where the
  // `md:w-16`/`md:hidden` CSS below never applies anyway, but SidebarNavLink
  // branches in JS (not pure CSS) on its `collapsed` prop, so that has to be
  // forced false while the drawer is open.
  const effectiveCollapsed = collapsed && !sidebarOpen

  // Read the saved preference after mount only, so the server-rendered
  // markup (which has no access to localStorage) matches the client's first
  // render and avoids a hydration mismatch — same pattern as the cart.
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
        <span className="truncate text-sm font-semibold text-foreground">{business.name}</span>
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
            <span className="truncate font-serif text-base leading-none tracking-tight text-foreground transition-colors hover:text-primary" title="MElocalmarketplace Seller">
              MElocalmarketplace <span className="font-sans text-sm font-normal text-muted-foreground">Seller</span>
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
          <p className="truncate text-sm font-bold text-foreground">{business.name}</p>
          <span className="label-mono mt-1 inline-flex w-fit items-center rounded-full bg-gradient-brand-soft px-2 py-0.5 text-primary">
            {typeMeta.shortLabel}
          </span>
          <Link href={`/shop/${business.slug}`} className="mt-1.5 flex items-center gap-0.5 text-xs text-primary hover:underline">
            View my shop <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {navSections.map(section => (
            <div key={section.section}>
              <p className={`label-mono px-2 pb-2 pt-3 ${collapsed ? 'md:hidden' : ''}`}>
                {section.section}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => (
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
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t p-3">
          <SidebarNavLink
            href="/sell/settings"
            label="Settings"
            icon={Settings}
            color="slate"
            active={isActive('/sell/settings')}
            collapsed={effectiveCollapsed}
            onClick={() => setSidebarOpen(false)}
          />
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
