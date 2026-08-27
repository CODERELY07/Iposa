import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { CompassIcon } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[color-mix(in_oklch,var(--brand-violet),transparent_78%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-[color-mix(in_oklch,var(--brand-pink),transparent_82%)] blur-3xl" />
      <Card className="relative w-full max-w-md p-8 text-center shadow-card-hover">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
          <CompassIcon className="size-6 text-primary" />
        </div>
        <h1 className="mb-1 font-serif text-6xl font-normal tracking-tight text-foreground">404</h1>
        <p className="label-mono mb-3">Page Not Found</p>

        <p className="mb-6 text-sm text-muted-foreground">
          Sorry, the page you&apos;re looking for doesn&apos;t exist. It might have been moved, deleted, or you
          may not have access to it.
        </p>

        <Button size="lg" className="w-full" render={<Link href="/" />}>Go to Home</Button>

        <Separator className="my-6" />

        <p className="text-sm text-muted-foreground">
          Double-check the link, or <Link href="/" className="text-primary hover:underline">browse the marketplace</Link> instead.
        </p>
      </Card>
    </div>
  )
}
