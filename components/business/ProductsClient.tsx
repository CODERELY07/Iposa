'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Ingredient, RecipeItem, StoreCategory, StoreProduct } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import CategoryBadge from '@/components/marketplace/CategoryBadge'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Plus, Search, PackageSearch, X } from 'lucide-react'
import { getBusinessTypeMeta } from '@/lib/business/type-meta'
import { unitLabel } from '@/lib/business/units'
import type { BusinessType } from '@/lib/types/marketplace'

type Props = {
  initialProducts: StoreProduct[]
  categories: StoreCategory[]
  ingredients: Ingredient[]
  businessType: BusinessType
  // null when the shop hasn't enabled its affiliate program — the Affiliate
  // Cut column is hidden entirely in that case rather than shown as ₱0,
  // since there's nothing an affiliate could actually earn on this product.
  affiliateSettings: { commission_rate: number } | null
  onSaveAction: (payload: {
    id: number | null
    name: string
    category_id: number | null
    sku: string | null
    description: string | null
    image_url: string | null
    cost_price: number
    price: number
    stock: number
    is_active: boolean
  }, recipeItems: RecipeItem[]) => Promise<void>
  onDeleteAction: (id: number) => Promise<void>
}

const EMPTY_FORM = {
  name: '',
  category_id: '',
  sku: '',
  description: '',
  image_url: '',
  cost_price: '0',
  price: '',
  stock: '0',
  is_active: true,
}

const NO_CATEGORY = '__none__'

export default function ProductsClient({ initialProducts, categories, ingredients, businessType, affiliateSettings, onSaveAction, onDeleteAction }: Props) {
  const meta = getBusinessTypeMeta(businessType)
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantityUsed, setQuantityUsed] = useState('')

  const calculateRecipeStock = (recipesArray: RecipeItem[]) => {
    if (!recipesArray || recipesArray.length === 0) return null
    let maxPossibleProducts = Infinity
    recipesArray.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      if (!ing || item.quantity_used <= 0) {
        maxPossibleProducts = 0
        return
      }
      const possibleYield = Math.floor(Number(ing.current_stock) / item.quantity_used)
      if (possibleYield < maxPossibleProducts) maxPossibleProducts = possibleYield
    })
    return maxPossibleProducts === Infinity ? 0 : maxPossibleProducts
  }

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || String(p.category_id) === filterCat
      return matchSearch && matchCat
    })
  }, [initialProducts, search, filterCat])

  const currentRecipeCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      return sum + (Number(ing?.cost_per_unit ?? 0) * item.quantity_used)
    }, 0)
  }, [recipeItems, ingredients])

  const liveFormRecipeStock = useMemo(() => calculateRecipeStock(recipeItems), [recipeItems])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setRecipeItems([])
    setError(null)
    setModalOpen(true)
  }

  function openEdit(p: StoreProduct) {
    setEditing(p)
    setForm({
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      sku: p.sku ?? '',
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      cost_price: String(p.cost_price),
      price: String(p.price),
      stock: String(p.stock),
      is_active: p.is_active,
    })
    setRecipeItems(p.recipes ?? [])
    setError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setRecipeItems([])
    setError(null)
  }

  function field(key: 'name' | 'sku' | 'description' | 'image_url' | 'cost_price' | 'price' | 'stock') {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  function addIngredientToRecipe() {
    if (!selectedIngredientId || !quantityUsed || parseFloat(quantityUsed) <= 0) return
    const ingId = Number(selectedIngredientId)
    const qty = parseFloat(quantityUsed)

    setRecipeItems(prev => {
      const existing = prev.find(item => item.ingredient_id === ingId)
      if (existing) {
        return prev.map(item => item.ingredient_id === ingId ? { ...item, quantity_used: qty } : item)
      }
      return [...prev, { ingredient_id: ingId, quantity_used: qty }]
    })
    setSelectedIngredientId('')
    setQuantityUsed('')
  }

  function removeIngredientFromRecipe(ingId: number) {
    setRecipeItems(prev => prev.filter(item => item.ingredient_id !== ingId))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const hasIngredients = recipeItems.length > 0
    const calculatedCost = hasIngredients ? 0 : parseFloat(form.cost_price || '0')
    // If ingredients exist, hardcode base stock storage to 0 because availability is determined dynamically
    const finalStockValue = hasIngredients ? 0 : parseInt(form.stock, 10)

    const payload = {
      id: editing?.id ?? null,
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      sku: form.sku || null,
      description: form.description || null,
      image_url: form.image_url || null,
      cost_price: calculatedCost,
      price: parseFloat(form.price),
      stock: finalStockValue,
      is_active: form.is_active,
    }

    startTransition(async () => {
      try {
        await onSaveAction(payload, recipeItems)
        closeModal()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save product.')
      }
    })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteId(id)
    try {
      await onDeleteAction(id)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">{meta.catalogLabel}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} {meta.catalogLabel.toLowerCase()} &middot; sold in-store via POS and listed on your marketplace shop
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 self-start sm:self-auto">
          <Plus /> Add {meta.catalogLabelSingular}
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${meta.catalogLabel.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-background pl-8"
          />
        </div>
        <Select value={filterCat || '__all__'} onValueChange={v => setFilterCat(!v || v === '__all__' ? '' : v)}>
          <SelectTrigger className="bg-background sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
              <TableHead className="p-4">Item</TableHead>
              <TableHead className="p-4">Category</TableHead>
              <TableHead className="p-4 font-mono text-[11px]">SKU</TableHead>
              <TableHead className="p-4 text-right">Cost</TableHead>
              <TableHead className="p-4 text-right">Price</TableHead>
              <TableHead className="p-4 text-right">Profit</TableHead>
              {affiliateSettings && <TableHead className="p-4 text-right">Affiliate Cut</TableHead>}
              {meta.tracksStock && <TableHead className="p-4 text-center">Type</TableHead>}
              {meta.tracksStock && <TableHead className="p-4 text-center">Stock</TableHead>}
              <TableHead className="p-4 text-center">Listed</TableHead>
              <TableHead className="p-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => {
              const hasRecipe = p.recipes && p.recipes.length > 0

              let totalCostForAnalytics = Number(p.cost_price)
              if (hasRecipe && p.recipes) {
                totalCostForAnalytics = p.recipes.reduce((sum, r) => {
                  const ing = ingredients.find(i => i.id === r.ingredient_id)
                  return sum + (Number(ing?.cost_per_unit ?? 0) * r.quantity_used)
                }, 0)
              }

              const dynamicStock = hasRecipe && p.recipes ? calculateRecipeStock(p.recipes) : p.stock

              // Same "profit" Analytics reports: selling price minus item
              // cost (recipe cost, or cost_price for a standalone item).
              const profit = Number(p.price) - totalCostForAnalytics
              const profitMargin = Number(p.price) > 0 ? (profit / Number(p.price)) * 100 : 0
              // What an affiliate actually earns per unit — commission_rate
              // applied to this profit, not to the selling price. Floored at
              // 0: an item priced at or below cost has no profit to share.
              const affiliateCut = affiliateSettings ? Math.max(profit, 0) * (affiliateSettings.commission_rate / 100) : 0

              return (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-normal p-4 font-bold text-foreground">{p.name}</TableCell>
                  <TableCell className="p-4">
                    {p.categories?.name ? (
                      <CategoryBadge name={p.categories.name} />
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="p-4 font-mono text-xs text-muted-foreground">{p.sku ?? '—'}</TableCell>
                  <TableCell className="p-4 text-right font-mono text-foreground">
                    ₱{totalCostForAnalytics.toFixed(2)}
                    <span className="block font-sans text-[9px] font-bold text-muted-foreground">
                      {hasRecipe ? `(${meta.recipeLabel} Cost)` : '(Supplier Cost)'}
                    </span>
                  </TableCell>
                  <TableCell className="p-4 text-right font-mono font-bold text-foreground">₱{Number(p.price).toFixed(2)}</TableCell>
                  <TableCell className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₱{profit.toFixed(2)}
                    <span className="block font-sans text-[9px] font-bold text-muted-foreground">{profitMargin.toFixed(0)}% margin</span>
                  </TableCell>
                  {affiliateSettings && (
                    <TableCell className="p-4 text-right font-mono text-amber-600 dark:text-amber-400">
                      -₱{affiliateCut.toFixed(2)}
                      <span className="block font-sans text-[9px] font-bold text-muted-foreground">{affiliateSettings.commission_rate}% of profit</span>
                    </TableCell>
                  )}
                  {meta.tracksStock && (
                    <TableCell className="p-4 text-center">
                      <Badge variant={hasRecipe ? 'default' : 'outline'} className="font-mono uppercase tracking-wider">
                        {hasRecipe ? meta.recipeLabel : 'Standalone'}
                      </Badge>
                    </TableCell>
                  )}
                  {meta.tracksStock && (
                    <TableCell className="p-4 text-center">
                      <Badge variant={dynamicStock === 0 ? 'destructive' : 'secondary'} className={dynamicStock !== 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : ''}>
                        {dynamicStock} units
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="p-4 text-center">
                    <Badge variant={p.is_active ? 'default' : 'secondary'} className="font-mono uppercase tracking-wider">
                      {p.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="destructive" size="icon-sm" onClick={() => setDeleteTarget(p)} disabled={deleteId === p.id} aria-label={`Delete ${meta.catalogLabelSingular.toLowerCase()}`}>
                        <X />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8 + (meta.tracksStock ? 2 : 0) + (affiliateSettings ? 1 : 0)}
                  className="p-10 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                      <PackageSearch className="size-5 text-primary" />
                    </span>
                    No {meta.catalogLabel.toLowerCase()} yet.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalOpen} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${meta.catalogLabelSingular}` : `Add ${meta.catalogLabelSingular}`}</DialogTitle>
            <DialogDescription>
              {meta.tracksStock
                ? 'Stock configurations adapt automatically based on your raw ingredient consumption.'
                : `${meta.catalogLabelSingular}s are always available to sell — there's no stock to track.`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">{meta.catalogLabelSingular} Name *</Label>
                <Input
                  required
                  autoFocus
                  placeholder={meta.tracksStock ? 'e.g., Sisig Rice Bowl' : 'e.g., Photocopy, Battery Replacement'}
                  {...field('name')}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select
                  value={form.category_id || NO_CATEGORY}
                  onValueChange={v => setForm(f => ({ ...f, category_id: !v || v === NO_CATEGORY ? '' : v }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No category assigned</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${meta.tracksStock ? 'sm:grid-cols-2' : ''}`}>
              <div className="space-y-1">
                <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">SKU / Barcode</Label>
                <Input placeholder="e.g., RET-COKE" {...field('sku')} />
              </div>
              {meta.tracksStock && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">
                    Stock
                    {recipeItems.length > 0 && <span className="ml-1 text-[10px] text-primary">(Calculated)</span>}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={recipeItems.length > 0}
                    value={recipeItems.length > 0 ? (liveFormRecipeStock ?? 0) : form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="font-bold"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/40 p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">
                  Cost Price (₱)
                  {recipeItems.length > 0 && <span className="ml-1 text-[10px] text-primary">(Bypassed by {meta.recipeLabel})</span>}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={recipeItems.length > 0}
                  placeholder="0.00"
                  {...field('cost_price')}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">Selling Price (₱) *</Label>
                <Input type="number" required min="0" step="0.01" placeholder="0.00" {...field('price')} className="bg-background" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">Image URL</Label>
              <Input type="url" placeholder="https://…" {...field('image_url')} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold font-mono uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea rows={2} {...field('description')} />
            </div>

            <Label className="flex w-fit items-center gap-2.5 font-normal text-foreground">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={value => setForm(f => ({ ...f, is_active: value === true }))}
              />
              Visible on your public marketplace shop
            </Label>

            {/* SECTION: Recipe/materials assembly — a retail business has no
                bill of materials to build (see lib/business/type-meta.ts),
                so this whole section is hidden rather than shown empty. */}
            {meta.showRecipeSection && (
            <div className="border-t pt-4">
              <h3 className="mb-1 text-xs font-bold font-mono uppercase tracking-wider text-foreground">{meta.recipeLabel} Construction</h3>
              <p className="mb-3 text-[10px] text-muted-foreground">Adding {meta.materialLabelSingular}s locks manual stock and computes available units from your {meta.materialLabel.toLowerCase()} inventory.</p>

              <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/40 p-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">{meta.materialLabelSingular}</Label>
                  <Select value={selectedIngredientId} onValueChange={v => setSelectedIngredientId(v ?? '')}>
                    <SelectTrigger size="sm" className="w-full bg-background"><SelectValue placeholder={`-- Choose ${meta.materialLabelSingular} --`} /></SelectTrigger>
                    <SelectContent>
                      {ingredients.map(ing => (
                        <SelectItem key={ing.id} value={String(ing.id)}>
                          {ing.name} (Avail: {ing.current_stock} {unitLabel(ing.unit_type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1 sm:w-24 sm:flex-none">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Qty</Label>
                    <Input type="number" step="0.01" placeholder="Amt" value={quantityUsed} onChange={e => setQuantityUsed(e.target.value)} className="bg-background font-mono" />
                  </div>
                  <Button type="button" size="icon" onClick={addIngredientToRecipe} className="shrink-0"><Plus /></Button>
                </div>
              </div>

              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {recipeItems.length === 0 ? (
                  <div className="rounded border border-dashed p-2 text-center text-[11px] italic text-muted-foreground">
                    Standalone product. Tracked via the fixed stock number above.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recipeItems.map((item, idx) => {
                      const ingObj = ingredients.find(i => i.id === item.ingredient_id)
                      return (
                        <div key={idx} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-xs">
                          <span className="font-semibold text-foreground">{ingObj?.name}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="font-mono">
                              {item.quantity_used} {ingObj ? unitLabel(ingObj.unit_type) : ''}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeIngredientFromRecipe(item.ingredient_id)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Remove ${meta.materialLabelSingular}`}
                            >
                              <X />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    <div className="mt-2 flex justify-between rounded-lg border bg-muted/40 p-2 text-xs font-bold text-foreground">
                      <div>{meta.recipeLabel} Cost: <span className="font-mono text-primary">₱{currentRecipeCost.toFixed(2)}</span></div>
                      <div>Max Yield: <span className="font-mono text-emerald-600 dark:text-emerald-400">{liveFormRecipeStock} units</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            <DialogFooter className="-mx-4 -mb-4 border-t bg-transparent p-0 pt-4 sm:justify-stretch">
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? 'Saving…' : editing ? 'Save changes' : `Create ${meta.catalogLabelSingular}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? 'this ' + meta.catalogLabelSingular.toLowerCase()}?`}
        description="This can't be undone. It will disappear from your POS and, if listed, from your public marketplace shop."
        confirmLabel="Delete"
        loading={deleteId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
