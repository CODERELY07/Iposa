import Link from 'next/link'
import { PackageSearch } from 'lucide-react'

export default function MarketplaceFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="h-0.5 w-full bg-gradient-brand" />
      <div className="mx-auto grid max-w-310 grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4 sm:px-7">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <PackageSearch className="size-4" />
            </span>
            <span className="font-serif text-xl leading-none tracking-tight text-foreground">Iposa</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            One platform for local shops to sell in person and online.
          </p>
        </div>

        <div>
          <p className="label-mono">Shop</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">Browse products</Link>
            <Link href="/cart" className="text-muted-foreground transition-colors hover:text-foreground">Your cart</Link>
            <Link href="/orders" className="text-muted-foreground transition-colors hover:text-foreground">Track orders</Link>
          </div>
        </div>

        <div>
          <p className="label-mono">Grow with Iposa</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/register-business" className="text-muted-foreground transition-colors hover:text-foreground">Sell on Iposa</Link>
            <Link href="/become-affiliate" className="text-muted-foreground transition-colors hover:text-foreground">Become an affiliate</Link>
          </div>
        </div>

        <div>
          <p className="label-mono">Account</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="text-muted-foreground transition-colors hover:text-foreground">Create account</Link>
          </div>
        </div>
      </div>

      <div className="label-mono border-t px-4 py-4 text-center sm:px-7">
        &copy; {new Date().getFullYear()} Iposa Marketplace. All rights reserved.
      </div>
    </footer>
  )
}
