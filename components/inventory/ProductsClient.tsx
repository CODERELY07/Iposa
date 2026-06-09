'use client'

import { useState, useMemo, useTransition } from 'react'

type Product = {
  id: number
  name: string
  category_id: number | null
  sku: string | null
  cost_price: number    
  selling_price: number
  stock: number
  categories: { name: string } | null
  recipes?: { ingredient_id: number; quantity_used: number }[]
}

type Category = { id: number; name: string }
type Ingredient = { id: number; name: string; unit_type: string; cost_per_unit: number; current_stock: number }

type Props = {
  initialProducts: Product[]
  categories: Category[]
  ingredients: Ingredient[]
  onSaveAction: (payload: any, recipeItems: any[]) => Promise<void>
  onDeleteAction: (id: number) => Promise<void>
}

const EMPTY_FORM = {
  name: '',
  category_id: '',
  sku: '',
  cost_price: '0', 
  selling_price: '',
  stock: '0',
}

export default function ProductsClient({ initialProducts, categories, ingredients, onSaveAction, onDeleteAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [recipeItems, setRecipeItems] = useState<{ ingredient_id: number; quantity_used: number }[]>([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantityUsed, setQuantityUsed] = useState('')

  // HELPER FUNCTION: Calculates maximum structural units reproducible from ingredient sets
  const calculateRecipeStock = (recipesArray: { ingredient_id: number; quantity_used: number }[]) => {
    if (!recipesArray || recipesArray.length === 0) return null

    let maxPossibleProducts = Infinity

    recipesArray.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      if (!ing || item.quantity_used <= 0) {
        maxPossibleProducts = 0
        return
      }
      // Division determines how many total items can be crafted out of this single raw material chunk
      const possibleYield = Math.floor(Number(ing.current_stock) / item.quantity_used)
      if (possibleYield < maxPossibleProducts) {
        maxPossibleProducts = possibleYield
      }
    })

    return maxPossibleProducts === Infinity ? 0 : maxPossibleProducts
  };

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

  // Live calculation of max build capacity while working inside the creation form modal
  const liveFormRecipeStock = useMemo(() => {
    return calculateRecipeStock(recipeItems)
  }, [recipeItems])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setRecipeItems([])
    setError(null)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      sku: p.sku ?? '',
      cost_price: String(p.cost_price), 
      selling_price: String(p.selling_price),
      stock: String(p.stock),
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

  function field(key: keyof typeof EMPTY_FORM) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
      id: editing?.id || null,
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      sku: form.sku || null,
      cost_price: calculatedCost,
      selling_price: parseFloat(form.selling_price),
      stock: finalStockValue,
    }

    startTransition(async () => {
      try {
        await onSaveAction(payload, recipeItems)
        closeModal()
      } catch (err: any) {
        setError(err?.message || 'Failed to complete transaction query.')
      }
    })
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this product?')) return
    setDeleteId(id)
    try {
      await onDeleteAction(id)
    } catch (err: any) {
      alert(`Delete operation failed: ${err.message}`)
    } finally {
      setDeleteId(null)
    }
  }

  const inputCls = 'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-medium'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Products Catalog</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{filtered.length} products total tracked</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
        >
          + Add Product Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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

      {/* Table Area */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="p-4">Item Description</th>
                <th className="p-4">Category</th>
                <th className="p-4 font-mono text-[11px]">SKU</th>
                <th className="p-4 text-right">Cost Price</th>
                <th className="p-4 text-right">Selling Price</th>
                <th className="p-4 text-center">Ecosystem Type</th>
                <th className="p-4 text-center">Stock Level Availability</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {filtered.map(p => {
                const hasRecipe = p.recipes && p.recipes.length > 0
                
                // Calculate Dynamic Cost Price if Recipe exists
                let totalCostForAnalytics = Number(p.cost_price)
                if (hasRecipe && p.recipes) {
                  totalCostForAnalytics = p.recipes.reduce((sum, r) => {
                    const ing = ingredients.find(i => i.id === r.ingredient_id)
                    return sum + (Number(ing?.cost_per_unit ?? 0) * r.quantity_used)
                  }, 0)
                }

                // Calculate Live Stock Count dynamically based on limiting ingredients
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
                    <td className="p-4 text-right font-mono font-bold text-zinc-900">₱{Number(p.selling_price).toFixed(2)}</td>
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
                      {hasRecipe && (
                        <span className="text-[9px] block text-blue-500 font-sans font-bold mt-0.5">Calculated from Raw Stock</span>
                      )}
                      {!hasRecipe && (
                        <span className="text-[9px] block text-zinc-400 font-sans font-bold mt-0.5">Fixed Stock Container</span>
                      )}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto grid grid-cols-1 gap-5">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{editing ? 'Edit Catalog Asset' : 'Register New Product'}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">Stock configurations adapt seamlessly based on your raw component matrices.</p>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg font-medium">{error}</div>}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">SKU / Barcode</label>
                  <input type="text" placeholder="e.g., RET-COKE" {...field('sku')} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    Retail Stock Level
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

              <div className="grid grid-cols-2 gap-3 bg-zinc-50 border border-zinc-100 p-3 rounded-xl">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-500 font-bold">
                    Supplier Buying Cost (₱) 
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
                  <label className="block text-xs text-zinc-500 font-bold">Retail Selling Price (₱) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="0.00" {...field('selling_price')} className={inputCls} />
                </div>
              </div>

              {/* SECTION: Recipe Assembly */}
              <div className="border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-1">Recipe Construction</h3>
                <p className="text-[10px] text-zinc-400 mb-3">Adding items locks standard stock and computes output capacity using current ingredient parameters.</p>
                
                <div className="flex gap-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100 items-end mb-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-400 font-bold">Raw Component</label>
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
                      Standalone Product Asset. Tracked via fixed storage numbers.
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
                        <div>Total Production Cost: <span className="font-mono text-blue-600">₱{currentRecipeCost.toFixed(2)}</span></div>
                        <div>Max Build Capacity: <span className="font-mono text-emerald-600">{liveFormRecipeStock} units</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Rows */}
              <div className="flex gap-2 pt-2 border-t border-zinc-100">
                <button type="button" onClick={closeModal} className="flex-1 text-sm text-zinc-600 border border-zinc-200 rounded-lg py-2 hover:bg-zinc-50 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 rounded-lg py-2 transition cursor-pointer">
                  {isPending ? 'Saving directly...' : editing ? 'Save changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}