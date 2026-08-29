import Link from 'next/link'
import type { MarketplaceOffering } from '@/lib/types/marketplace'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import CategoryBadge from '@/components/marketplace/CategoryBadge'
import { Sparkles, ArrowRight } from 'lucide-react'

// Storefront card for a non-POS offering — the counterpart to ProductCard,
// which stays untouched. No "Add to cart": this links straight to the
// dynamic request form, since requires_pos = false never enters checkout.
export default function OfferingCard({ offering }: { offering: MarketplaceOffering }) {
  const href = `/shop/${offering.business_slug}/service/${offering.slug}`

  return (
    <Card className="card-interactive group overflow-hidden py-0">
      <Link href={href} className="relative flex aspect-4/3 items-center justify-center overflow-hidden bg-gradient-brand-soft">
        {offering.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offering.image_url}
            alt={offering.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Sparkles className="size-10 text-primary/30" />
        )}
        <Badge variant="outline" className="absolute left-2 top-2 border-primary/30 bg-background/90 text-primary shadow-sm">Request</Badge>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link href={`/shop/${offering.business_slug}`} className="label-mono truncate hover:text-primary">
          {offering.business_name}
        </Link>

        <Link href={href}>
          <h3 className="line-clamp-2 text-[15px] font-medium leading-[1.35] tracking-[-0.005em] text-foreground transition-colors group-hover:text-primary">
            {offering.name}
          </h3>
        </Link>

        {offering.category_name && (
          <CategoryBadge name={offering.category_name} className="w-fit text-[10px] font-mono uppercase tracking-wider" />
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="truncate text-sm font-bold tracking-[-0.01em] text-foreground">
            {offering.price != null
              ? `${offering.price_label ?? ''} ₱${Number(offering.price).toFixed(2)}`
              : offering.price_label ?? 'Get a quote'}
          </span>
          <Link href={href} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105" aria-label={`Request ${offering.name}`}>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </Card>
  )
}
