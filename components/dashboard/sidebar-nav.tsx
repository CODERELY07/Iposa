'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Tailwind needs complete, static class strings to detect them at build
// time — a template literal like `bg-${color}-500/15` would not survive
// production builds, hence this lookup table instead of building names.
export const NAV_COLORS = {
  emerald: { chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  sky: { chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' },
  violet: { chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', bar: 'bg-violet-500' },
  amber: { chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  rose: { chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' },
  indigo: { chip: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500' },
  teal: { chip: 'bg-teal-500/15 text-teal-600 dark:text-teal-400', bar: 'bg-teal-500' },
  fuchsia: { chip: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400', bar: 'bg-fuchsia-500' },
  slate: { chip: 'bg-slate-500/15 text-slate-600 dark:text-slate-400', bar: 'bg-slate-500' },
} as const

export type NavColor = keyof typeof NAV_COLORS

// One nav row: a colored icon chip (always visible), a label (hidden when
// the sidebar is collapsed to icons-only), and a tooltip that only kicks in
// while collapsed — expanded mode already shows the label inline.
export function SidebarNavLink({
  href,
  label,
  icon: Icon,
  color,
  active,
  collapsed,
  onClick,
}: {
  href: string
  label: string
  icon: LucideIcon
  color: NavColor
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const palette = NAV_COLORS[color]

  const link = (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors ${
        collapsed ? 'justify-center px-2' : 'px-3'
      } ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      {active && <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full ${palette.bar}`} />}
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${palette.chip}`}>
        <Icon className="size-3.5" />
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
