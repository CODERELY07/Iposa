'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CheckCircle2, AlertCircle, Search, ShoppingCart, Minus, Plus, X, Sparkles } from 'lucide-react'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import type { BusinessType } from '@/lib/types/marketplace'

type Product = {
  id: number
  name: string
  category_id: number | null
  sku: string | null
  cost_price: number
  price: number
  stock: number
  // false for a service — always available regardless of `stock`.
  track_stock: boolean
  categories: { name: string } | null
  recipes?: { ingredient_id: number; quantity_used: number }[]
}

type Category = { id: number; name: string }
type Ingredient = { id: number; name: string; current_stock: number }

// A catalog line comes straight from the product grid, same as always. A
// custom line is a made-to-order item that was never worth adding to the
// catalog (a print shop's one-off oddly-sized job is the motivating case,
// but every business type can ring one up) — it's priced and costed on the
// spot instead of looked up, carries no stock/ingredient checks, and is
// tagged with a client-side `key` (never a real product id) so it can share
// the same cart list and quantity controls as a catalog line.
type CatalogCartItem = { kind: 'catalog'; key: string; product: Product; quantity: number }
type CustomCartItem = { kind: 'custom'; key: string; name: string; price: number; cost: number; quantity: number }
type CartItem = CatalogCartItem | CustomCartItem

type Props = {
  initialProducts: Product[]
  categories: Category[]
  ingredients: Ingredient[]
  businessType: BusinessType
}

function itemName(item: CartItem) {
  return item.kind === 'catalog' ? item.product.name : item.name
}

function itemUnitPrice(item: CartItem) {
  return item.kind === 'catalog' ? Number(item.product.price) : item.price
}

export default function PosClient({ initialProducts, categories, ingredients, businessType }: Props) {
  const supabase = createClient()
  const meta = getBusinessTypeMeta(businessType)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customCost, setCustomCost] = useState('')

  const [cashReceived, setCashReceived] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const getAvailableStock = (product: Product) => {
    if (!product.track_stock) {
      return Infinity
    }
    if (!product.recipes || product.recipes.length === 0) {
      return product.stock
    }
    let maxPossibleProducts = Infinity
    product.recipes.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      if (!ing || item.quantity_used <= 0) {
        maxPossibleProducts = 0
        return
      }
      const possibleYield = Math.floor(Number(ing.current_stock) / item.quantity_used)
      if (possibleYield < maxPossibleProducts) {
        maxPossibleProducts = possibleYield
      }
    })
    return maxPossibleProducts === Infinity ? 0 : maxPossibleProducts
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || String(p.category_id) === filterCat
      return matchSearch && matchCat
    })
  }, [products, search, filterCat])

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + itemUnitPrice(item) * item.quantity, 0)
  }, [cart])

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  const cashChange = useMemo(() => {
    const cash = parseFloat(cashReceived)
    if (isNaN(cash) || cash < cartTotal) return 0
    return cash - cartTotal
  }, [cashReceived, cartTotal])

  function addToCart(product: Product) {
    const availableStock = getAvailableStock(product)
    if (availableStock <= 0) return

    setCart(prev => {
      const existing = prev.find(item => item.kind === 'catalog' && item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= availableStock) return prev
        return prev.map(item =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { kind: 'catalog', key: `p-${product.id}`, product, quantity: 1 }]
    })
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function addCustomItem() {
    const price = parseFloat(customPrice)
    if (!customName.trim() || isNaN(price) || price < 0) return
    const cost = parseFloat(customCost)

    setCart(prev => [
      ...prev,
      {
        kind: 'custom',
        key: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: customName.trim(),
        price,
        cost: isNaN(cost) ? 0 : cost,
        quantity: 1,
      },
    ])
    setCustomName('')
    setCustomPrice('')
    setCustomCost('')
    setCustomOpen(false)
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function updateQuantity(key: string, amount: number) {
    setCart(prev =>
      prev
        .map(item => {
          if (item.key !== key) return item
          const newQty = item.quantity + amount
          if (item.kind === 'catalog') {
            const availableStock = getAvailableStock(item.product)
            if (newQty > availableStock) return item
          }
          return { ...item, quantity: newQty }
        })
        .filter(item => item.quantity > 0)
    )
  }

  function removeItem(key: string) {
    setCart(prev => prev.filter(item => item.key !== key))
  }

  function clearCart() {
    setCart([])
    setCashReceived('')
    setErrorMessage(null)
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const paymentAmount = parseFloat(cashReceived)
    if (isNaN(paymentAmount) || paymentAmount < cartTotal) {
      setErrorMessage('Insufficient cash payment amount.')
      return
    }

    setLoading(true)

    const payloadItems = cart.map(item =>
      item.kind === 'catalog'
        ? {
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
            subtotal: item.product.price * item.quantity,
          }
        : {
            product_id: null,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
            custom_name: item.name,
            custom_cost: item.cost,
          }
    )

    const { data: saleId, error } = await supabase.rpc('process_sale', {
      p_total: cartTotal,
      p_payment: paymentAmount,
      p_change: cashChange,
      p_items: payloadItems,
    })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    setProducts(prevProducts =>
      prevProducts.map(prod => {
        const soldItem = cart.find(item => item.kind === 'catalog' && item.product.id === prod.id)
        return soldItem ? { ...prod, stock: Math.max(0, prod.stock - soldItem.quantity) } : prod
      })
    )

    setSuccessMessage(`Sale completed successfully! Reference ID: #${saleId}`)
    clearCart()
    setLoading(false)
  }

  const customButtonLabel = businessType === 'services' ? 'New Custom Job' : 'Add Custom Item'

  return (
    <div className="flex h-full flex-col bg-muted/30 lg:mx-auto lg:max-w-[1600px] lg:flex-row lg:overflow-hidden">

      <div className="flex flex-col border-b p-4 sm:p-5 lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r lg:w-7/12">

        {successMessage && (
          <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 />
            <AlertDescription className="text-emerald-700 dark:text-emerald-400">{successMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Scan SKU or type product name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-background pl-8"
            />
          </div>
          <Select value={filterCat || '__all__'} onValueChange={v => setFilterCat(!v || v === '__all__' ? '' : v)}>
            <SelectTrigger className="bg-background sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {meta.customItemEmphasis === 'primary' ? (
            <Button type="button" onClick={() => setCustomOpen(true)} className="shrink-0">
              <Sparkles /> {customButtonLabel}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setCustomOpen(true)} className="shrink-0">
              <Plus /> Custom item
            </Button>
          )}
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-20 text-center text-sm text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                <Search className="size-5 text-primary" />
              </span>
              No matching products found.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredProducts.map(p => {
                const liveStock = getAvailableStock(p)
                const isOutOfStock = liveStock <= 0
                const cartItem = cart.find(item => item.kind === 'catalog' && item.product.id === p.id)
                const isMaxed = cartItem ? cartItem.quantity >= liveStock : false

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock || isMaxed || loading}
                    onClick={() => addToCart(p)}
                    className="card-interactive group flex cursor-pointer flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-card outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-card"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {p.name}
                        </span>
                        {cartItem && (
                          <Badge className="shrink-0">{cartItem.quantity}</Badge>
                        )}
                      </div>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        {p.sku ?? 'No SKU'}
                      </span>
                    </div>

                    <div className="mt-4 flex w-full items-center justify-between border-t pt-2">
                      <span className="text-base font-semibold text-foreground">
                        ₱{Number(p.price).toFixed(2)}
                      </span>
                      <Badge
                        variant={isOutOfStock ? 'destructive' : 'outline'}
                        className={isOutOfStock ? '' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'}
                      >
                        {isOutOfStock ? 'Sold Out' : !p.track_stock ? 'Available' : `${liveStock} units`}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleCheckout} className="flex flex-col bg-card lg:h-full lg:w-5/12">
        <div className="flex items-center justify-between border-b bg-gradient-brand-soft p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Current Ticket</h2>
            <p className="text-xs text-muted-foreground">{totalItems} items selected</p>
          </div>
          {cart.length > 0 && !loading && (
            <Button type="button" variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              Clear Cart
            </Button>
          )}
        </div>

        <div className="divide-y px-4 lg:flex-1 lg:overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground lg:h-full lg:py-20">
              <span className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                <ShoppingCart className="size-6 text-primary" />
              </span>
              <p className="text-sm font-medium">Cart is currently empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="truncate text-sm font-medium text-foreground">{itemName(item)}</h4>
                    {item.kind === 'custom' && (
                      <Badge variant="outline" className="shrink-0 border-primary/30 text-[10px] text-primary">Custom</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">₱{itemUnitPrice(item).toFixed(2)} each</p>
                </div>

                <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    disabled={loading}
                    onClick={() => updateQuantity(item.key, -1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-mono text-xs font-semibold text-foreground">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    disabled={(item.kind === 'catalog' && item.quantity >= getAvailableStock(item.product)) || loading}
                    onClick={() => updateQuantity(item.key, 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus />
                  </Button>
                </div>

                <div className="min-w-[70px] text-right">
                  <span className="block text-sm font-semibold text-foreground">
                    ₱{(itemUnitPrice(item) * item.quantity).toFixed(2)}
                  </span>
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-2.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3.5 border-t bg-muted/30 p-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>₱{cartTotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <label className="whitespace-nowrap text-xs font-medium text-foreground">Cash Tendered</label>
              <div className="relative max-w-[160px] flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  required
                  disabled={cart.length === 0 || loading}
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="bg-background pl-6 text-right font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
              <span>Change Amount</span>
              <span className="font-mono text-foreground">₱{cashChange.toFixed(2)}</span>
            </div>

            <div className="flex justify-between rounded-lg bg-gradient-brand-soft px-3 py-2.5 text-base font-bold text-foreground">
              <span>Total Bill</span>
              <span className="font-mono text-primary">₱{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={cart.length === 0 || loading || parseFloat(cashReceived) < cartTotal || !cashReceived}
          >
            {loading ? 'Processing Sale...' : 'Finalize Sale & Print Receipt'}
          </Button>
        </div>
      </form>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{customButtonLabel}</DialogTitle>
            <DialogDescription>
              For made-to-order work that isn&apos;t in your catalog — priced and costed right here, with no stock to track.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="custom-name">Description *</Label>
              <Input
                id="custom-name"
                autoFocus
                placeholder={businessType === 'services' ? 'e.g., Rush same-day repair, custom quote' : 'e.g., Special request'}
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-price">Price charged (₱) *</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-cost">Your cost (₱)</Label>
                <Input
                  id="custom-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={customCost}
                  onChange={e => setCustomCost(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cost is optional — leave it blank if this is pure margin. Either way it flows straight into your Analytics profit numbers, same as a catalog sale.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={addCustomItem}
              disabled={!customName.trim() || customPrice === '' || isNaN(parseFloat(customPrice)) || parseFloat(customPrice) < 0}
            >
              Add to ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
