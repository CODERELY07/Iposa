'use client'

import Link from 'next/link'
import { useCart } from '@/lib/marketplace/cart-context'
import SignOutButton from '@/components/auth/SignOutButton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Menu, ShoppingCart, Store, ShieldCheck, Link2, PackageSearch, LogIn } from 'lucide-react'
import type { UserRole } from '@/lib/supabase/server'

type Props = {
  userEmail: string | null
  role: UserRole | null
}

export default function MarketplaceHeader({ userEmail, role }: Props) {
  const { totalItems } = useCart()

  const roleLink =
    role === 'business_admin'
      ? { href: '/sell', label: 'My Store', icon: Store }
      : role === 'affiliate'
        ? { href: '/affiliate', label: 'My Affiliate Dashboard', icon: Link2 }
        : role === 'super_admin'
          ? { href: '/admin/businesses', label: 'Admin', icon: ShieldCheck }
          : null

  const navLinkClass =
    'relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-gradient-brand after:transition-all after:duration-200 hover:after:w-full'

  const navLinks = (
    <>
      <Link href="/" className={navLinkClass}>
        Browse
      </Link>
      {userEmail && (
        <Link href="/orders" className={navLinkClass}>
          My Orders
        </Link>
      )}
      {roleLink && (
        <Link href={roleLink.href} className={navLinkClass}>
          {roleLink.label}
        </Link>
      )}
      {(role === null || role === 'customer') && (
        <>
          <Link href="/register-business" className={navLinkClass}>
            Sell on Iposa
          </Link>
          <Link href="/become-affiliate" className={navLinkClass}>
            Become an Affiliate
          </Link>
        </>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-[66px] max-w-310 items-center justify-between gap-4 px-4 sm:px-7">
        <div className="flex shrink-0 items-center gap-1">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Toggle menu" />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-serif text-lg">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary">
                    <PackageSearch className="size-4" />
                  </span>
                  Iposa
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4 pb-4 text-sm">{navLinks}</nav>
              {userEmail && (
                <div className="border-t px-4 pb-4 pt-3">
                  <SignOutButton redirectTo="/" className="text-sm font-medium text-destructive" />
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Link href="/" className="group flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary transition-transform group-hover:scale-105">
              <PackageSearch className="size-4.5" />
            </span>
            <span className="font-serif text-[25px] leading-none tracking-tight text-foreground">
              Iposa<span className="hidden italic text-gradient-brand sm:inline"> Marketplace</span>
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 sm:flex">{navLinks}</nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="relative"
            render={<Link href="/cart" />}
          >
            <ShoppingCart />
            <span className="hidden sm:inline">Cart</span>
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Button>

          {userEmail ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {userEmail.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-48 truncate font-normal text-foreground">{userEmail}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roleLink && (
                  <DropdownMenuItem render={<Link href={roleLink.href} />}>
                    <roleLink.icon /> {roleLink.label}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem render={<Link href="/orders" />}>
                  <PackageSearch /> My Orders
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-1.5 py-1">
                  <SignOutButton
                    redirectTo="/"
                    className="flex w-full items-center gap-1.5 rounded-md text-sm text-destructive hover:underline disabled:opacity-50"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button render={<Link href="/login" />}>
              <LogIn /> Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
