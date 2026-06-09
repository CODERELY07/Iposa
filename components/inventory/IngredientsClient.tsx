'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Ingredient = {
  id: number
  name: string
  current_stock: number
  min_stock_alert: number
  cost_per_unit: number
}

type Props = {
  initialIngredients: Ingredient[]
  onIngredientsChanged?: () => void // Optional callback to trigger a parent page refresh
}

export default function IngredientsClient({ initialIngredients, onIngredientsChanged }: Props) {
  const supabase = createClient()
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  
  // Form / Selection States
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    current_stock: '',
    min_stock_alert: '',
    cost_per_unit: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Track state transitions cleanly
  const resetForm = () => {
    setFormData({ name: '', current_stock: '', min_stock_alert: '', cost_per_unit: '' })
    setEditingId(null)
  }

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id)
    setFormData({
      name: ing.name,
      current_stock: String(ing.current_stock),
      min_stock_alert: String(ing.min_stock_alert),
      cost_per_unit: String(ing.cost_per_unit)
    })
  }

  // --- 1. SAVE OR UPDATE ACTION ---
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const payload = {
      name: formData.name,
      current_stock: Number(formData.current_stock || 0),
      min_stock_alert: Number(formData.min_stock_alert || 0),
      cost_per_unit: Number(formData.cost_per_unit || 0)
    }

    if (editingId) {
      // UPDATE MATCHING RECORD
      const { data, error: uErr } = await supabase
        .from('ingredients')
        .update(payload)
        .eq('id', editingId)
        .select()

      if (uErr) {
        setError(uErr.message)
      } else if (data) {
        setIngredients(prev => prev.map(i => i.id === editingId ? data[0] : i))
        setSuccess('Ingredient details updated successfully!')
        resetForm()
      }
    } else {
      // CREATE FRESH RECORD
      const { data, error: cErr } = await supabase
        .from('ingredients')
        .insert([payload])
        .select()

      if (cErr) {
        setError(cErr.message)
      } else if (data) {
        setIngredients(prev => [...prev, data[0]])
        setSuccess('New ingredient registered successfully!')
        resetForm()
      }
    }
    
    setLoading(false)
    if (onIngredientsChanged) onIngredientsChanged()
  }

  // --- 2. DELETE ACTION WITH CONSTRAINT PROTECTIONS ---
  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${name}"? This will cause recipe calculation discrepancies if it's attached to products.`)
    if (!confirmed) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error: dErr } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (dErr) {
      setError(dErr.message)
    } else {
      setIngredients(prev => prev.filter(i => i.id !== id))
      setSuccess('Ingredient removed successfully.')
      if (editingId === id) resetForm()
    }
    setLoading(false)
    if (onIngredientsChanged) onIngredientsChanged()
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
      
      {/* LEFT: FORM MANAGEMENT CHANNEL */}
      <div className="p-5 bg-zinc-50/50">
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">
          {editingId ? 'Modify Ingredient' : 'Register New Ingredient'}
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          Maintain precise baselines to generate accurate COGS parameters.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Ingredient Name</label>
            <input
              type="text"
              required
              placeholder="e.g., Espresso Beans, Milk, Syrup"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Current Stock</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0"
                value={formData.current_stock}
                onChange={e => setFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Alert Threshold</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="10"
                value={formData.min_stock_alert}
                onChange={e => setFormData(prev => ({ ...prev, min_stock_alert: e.target.value }))}
                className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Cost Per Unit (₱)</label>
            <div className="relative">
              <span className="absolute left-3 top-1.5 text-xs text-zinc-400 font-medium">₱</span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={formData.cost_per_unit}
                onChange={e => setFormData(prev => ({ ...prev, cost_per_unit: e.target.value }))}
                className="w-full bg-white border border-zinc-200 rounded-lg pl-6 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-medium py-2 rounded-lg transition shadow-sm cursor-pointer text-center"
            >
              {editingId ? 'Update Record' : 'Save Ingredient'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium px-3 py-2 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Status Messaging Block */}
        {(success || error) && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-medium border ${
            success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
          }`}>
            {success || error}
          </div>
        )}
      </div>

      {/* RIGHT: LIVE DATA LEDGER VIEWER */}
      <div className="col-span-2 flex flex-col overflow-hidden h-[500px]">
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-zinc-700">Registered Stock Catalog</span>
          <span className="text-[11px] font-mono bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
            {ingredients.length} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {ingredients.length === 0 ? (
            <div className="text-center py-20 text-sm text-zinc-400">
              No ingredients on file. Use the entry matrix to build your baseline ledger.
            </div>
          ) : (
            ingredients.map(ing => {
              const isLowStock = Number(ing.current_stock) <= Number(ing.min_stock_alert)
              
              return (
                <div key={ing.id} className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/60 transition">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-zinc-900 truncate">{ing.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-500 font-mono">
                        Cost: ₱{Number(ing.cost_per_unit).toFixed(2)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isLowStock ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {ing.current_stock} remaining (Alert: {ing.min_stock_alert})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(ing)}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 rounded-md transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ing.id, ing.name)}
                      className="text-xs font-medium text-red-500 hover:text-white hover:bg-red-600 px-2.5 py-1.5 rounded-md transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}