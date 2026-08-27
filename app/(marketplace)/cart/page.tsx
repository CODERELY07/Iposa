'use client'

import Link from 'next/link'
import { useCart } from '@/lib/marketplace/cart-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, PackageOpen, Minus, Plus, X } from 'lucide-react'

export default function CartPage() {
  const { groupedByBusiness, totalPrice, totalItems, setQuantity, removeItem } = useCart()

  if (totalItems === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center sm:px-6">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-brand-soft">
          <ShoppingCart className="size-7 text-primary" />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Your cart is empty</h1>
        <p className="mb-2 text-sm text-muted-foreground">Browse the marketplace and add something you like.</p>
        <Button render={<Link href="/" />}>Start browsing</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Your cart</h1>

      {groupedByBusiness.map(group => (
        <Card key={group.businessId} className="overflow-hidden py-0">
          <div className="label-mono border-b bg-muted/50 px-4 py-2.5">
            {group.businessName}
          </div>
          <div className="divide-y">
            {group.items.map(item => (
              <div key={item.productId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <PackageOpen className="size-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 sm:min-w-[140px]">
                    <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">₱{item.price.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:ml-auto sm:justify-end">
                  <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center font-mono text-xs font-semibold text-foreground">{item.quantity}</span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus />
                    </Button>
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-sm font-bold text-foreground">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(item.productId)}
                    aria-label="Remove item"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t bg-muted/30 px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
            Shop subtotal: <span className="font-mono text-foreground">₱{group.subtotal.toFixed(2)}</span>
          </div>
        </Card>
      ))}

      <Card className="flex flex-row items-center justify-between bg-gradient-brand-soft p-4">
        <div>
          {groupedByBusiness.length > 1 && (
            <Badge variant="secondary" className="mb-1">
              {groupedByBusiness.length} separate orders at checkout
            </Badge>
          )}
          <p className="font-mono text-xl font-bold text-foreground">₱{totalPrice.toFixed(2)}</p>
        </div>
        <Button size="lg" render={<Link href="/checkout" />}>Checkout</Button>
      </Card>
    </div>
  )
}
