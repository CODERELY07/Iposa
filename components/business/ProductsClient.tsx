'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Ingredient, RecipeItem, StoreCategory, StoreProduct } from '@/lib/types/marketplace'

type Props = {
  initialProducts: StoreProduct[]
  categories: StoreCategory[]
  ingredients: Ingredient[]
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

export default function ProductsClient({ initialProducts, categories, ingredients, onSaveAction, onDeleteAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
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

  function field(key: 'name' | 'category_id' | 'sku' | 'description' | 'image_url' | 'cost_price' | 'price' | 'stock') {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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

  const inputCls = 'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-medium'

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

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this product?')) return
    setDeleteId(id)
    try {
      await onDeleteAction(id)
    } catch (err) {
      alert(`Delete operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Products</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{filtered.length} products &middot; sold in-store via POS and listed on your marketplace shop</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer self-start sm:self-auto shrink-0"
        >
          + Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search catalog items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="p-4">Item</th>
                <th className="p-4">Category</th>
                <th className="p-4 font-mono text-[11px]">SKU</th>
                <th className="p-4 text-right">Cost</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-center">Type</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-center">Listed</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
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

                return (
                  <tr key={p.id} className="hover:bg-zinc-50/50 transition">
                    <td className="p-4 font-bold text-zinc-900">{p.name}</td>
                    <td className="p-4">
                      {p.categories?.name ? (
                        <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                          {p.categories.name}
                        </span>
                      ) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="p-4 font-mono text-zinc-400 text-xs">{p.sku ?? '—'}</td>
                    <td className="p-4 text-right font-mono text-zinc-900">
                      ₱{totalCostForAnalytics.toFixed(2)}
                      <span className="text-[9px] block text-zinc-400 font-sans font-bold">
                        {hasRecipe ? '(Recipe Cost)' : '(Supplier Cost)'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-zinc-900">₱{Number(p.price).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {hasRecipe ? (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">Recipe</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-wider">Standalone</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dynamicStock === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {dynamicStock} units
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {p.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 px-2.5 py-1 rounded bg-white transition cursor-pointer">Edit</button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleteId === p.id} className="text-xs text-red-500 hover:text-red-700 border border-red-50 px-2.5 py-1 rounded bg-white transition cursor-pointer disabled:opacity-40">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-zinc-400 text-sm">No products yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto grid grid-cols-1 gap-5">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">Stock configurations adapt automatically based on your raw ingredient consumption.</p>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg font-medium">{error}</div>}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Product Name *</label>
                  <input type="text" required autoFocus placeholder="e.g., Sisig Rice Bowl" {...field('name')} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Category</label>
                  <select {...field('category_id')} className={inputCls}>
                    <option value="">No category assigned</option>
                    {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">SKU / Barcode</label>
                  <input type="text" placeholder="e.g., RET-COKE" {...field('sku')} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    Stock
                    {recipeItems.length > 0 && <span className="text-[10px] text-blue-500 ml-1">(Calculated)</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={recipeItems.length > 0}
                    value={recipeItems.length > 0 ? (liveFormRecipeStock ?? 0) : form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className={`${inputCls} disabled:bg-zinc-200/50 disabled:text-zinc-500 font-bold`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 border border-zinc-100 p-3 rounded-xl">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-500 font-bold">
                    Cost Price (₱)
                    {recipeItems.length > 0 && <span className="text-[10px] text-blue-500 ml-1">(Bypassed by Recipe)</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={recipeItems.length > 0}
                    placeholder="0.00"
                    {...field('cost_price')}
                    className={`${inputCls} disabled:bg-zinc-200/50 disabled:text-zinc-400`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-500 font-bold">Selling Price (₱) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="0.00" {...field('price')} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Image URL</label>
                <input type="url" placeholder="https://…" {...field('image_url')} className={inputCls} />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">Description</label>
                <textarea rows={2} {...field('description')} className={inputCls} />
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                Visible on your public marketplace shop
              </label>

              {/* SECTION: Recipe Assembly */}
              <div className="border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-1">Recipe Construction</h3>
                <p className="text-[10px] text-zinc-400 mb-3">Adding ingredients locks manual stock and computes available units from your ingredient inventory.</p>

                <div className="flex gap-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100 items-end mb-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-400 font-bold">Ingredient</label>
                    <select value={selectedIngredientId} onChange={e => setSelectedIngredientId(e.target.value)} className="w-full bg-white border border-zinc-200 text-xs px-2.5 py-1.5 rounded-md">
                      <option value="">-- Choose Ingredient --</option>
                      {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} (Avail: {ing.current_stock} {ing.unit_type === 'pieces' ? 'pcs' : ing.unit_type === 'grams' ? 'g' : 'ml'})</option>)}
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-400 font-bold">Qty</label>
                    <input type="number" step="0.01" placeholder="Amt" value={quantityUsed} onChange={e => setQuantityUsed(e.target.value)} className="w-full bg-white border border-zinc-200 text-xs px-2.5 py-1.5 rounded-md font-mono" />
                  </div>
                  <button type="button" onClick={addIngredientToRecipe} className="bg-zinc-900 text-white font-bold text-xs px-3 py-1.5 rounded-md hover:bg-zinc-800 transition">+</button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {recipeItems.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 italic bg-zinc-50/50 p-2 text-center rounded border border-dashed border-zinc-200">
                      Standalone product. Tracked via the fixed stock number above.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recipeItems.map((item, idx) => {
                        const ingObj = ingredients.find(i => i.id === item.ingredient_id)
                        return (
                          <div key={idx} className="flex justify-between items-center bg-white border border-zinc-200 px-3 py-1.5 rounded-lg text-xs shadow-xs">
                            <span className="font-semibold text-zinc-800">{ingObj?.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                                {item.quantity_used} {ingObj?.unit_type === 'pieces' ? 'pcs' : ingObj?.unit_type === 'grams' ? 'g' : 'ml'}
                              </span>
                              <button type="button" onClick={() => removeIngredientFromRecipe(item.ingredient_id)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex justify-between text-xs font-bold text-zinc-900 px-1 pt-1 bg-zinc-50 p-2 rounded-lg mt-2 border border-zinc-100">
                        <div>Recipe Cost: <span className="font-mono text-blue-600">₱{currentRecipeCost.toFixed(2)}</span></div>
                        <div>Max Yield: <span className="font-mono text-emerald-600">{liveFormRecipeStock} units</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={closeModal} className="flex-1 text-sm text-zinc-600 border border-zinc-200 rounded-lg py-2 hover:bg-zinc-50 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 rounded-lg py-2 transition cursor-pointer">
                  {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
