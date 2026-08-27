'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Ingredient } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Soup } from 'lucide-react'
import type { BusinessTypeMeta } from '@/lib/business/type-meta'
import { UNIT_TYPES, unitLabel, type UnitType } from '@/lib/business/units'

type Props = {
  businessId: string
  initialIngredients: Ingredient[]
  materialMeta: BusinessTypeMeta
  onIngredientsChanged?: () => void // Optional callback to trigger a parent page refresh
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function IngredientsClient({ businessId, initialIngredients, materialMeta, onIngredientsChanged }: Props) {
  const singular = cap(materialMeta.materialLabelSingular)
  const supabase = createClient()
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    unit_type: 'grams' as UnitType,
    current_stock: '',
    min_stock_alert: '',
    cost_per_unit: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setFormData({ name: '', unit_type: 'grams', current_stock: '', min_stock_alert: '', cost_per_unit: '' })
    setEditingId(null)
  }

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id)
    setFormData({
      name: ing.name,
      unit_type: (ing.unit_type as UnitType) || 'grams',
      current_stock: String(ing.current_stock),
      min_stock_alert: String(ing.min_stock_alert),
      cost_per_unit: String(ing.cost_per_unit)
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name: formData.name,
      unit_type: formData.unit_type,
      current_stock: Number(formData.current_stock || 0),
      min_stock_alert: Number(formData.min_stock_alert || 0),
      cost_per_unit: Number(formData.cost_per_unit || 0)
    }

    if (editingId) {
      const { data, error: uErr } = await supabase
        .from('ingredients')
        .update(payload)
        .eq('id', editingId)
        .select()

      if (uErr) {
        setError(uErr.message)
      } else if (data) {
        setIngredients(prev => prev.map(i => i.id === editingId ? data[0] : i))
        toast.success('Ingredient details updated.')
        resetForm()
      }
    } else {
      const { data, error: cErr } = await supabase
        .from('ingredients')
        .insert([{ ...payload, business_id: businessId }])
        .select()

      if (cErr) {
        setError(cErr.message)
      } else if (data) {
        setIngredients(prev => [...prev, data[0]])
        toast.success('New ingredient registered.')
        resetForm()
      }
    }

    setLoading(false)
    if (onIngredientsChanged) onIngredientsChanged()
  }

  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${name}"? This will cause ${materialMeta.recipeLabel.toLowerCase()} calculation discrepancies if it's attached to products.`)
    if (!confirmed) return

    setLoading(true)
    setError(null)

    const { error: dErr } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (dErr) {
      setError(dErr.message)
    } else {
      setIngredients(prev => prev.filter(i => i.id !== id))
      toast.success('Ingredient removed.')
      if (editingId === id) resetForm()
    }
    setLoading(false)
    if (onIngredientsChanged) onIngredientsChanged()
  }

  return (
    <Card className="grid grid-cols-1 divide-y overflow-hidden py-0 md:grid-cols-3 md:divide-x md:divide-y-0">
      <div className="bg-muted/30 p-5">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          {editingId ? `Modify ${singular}` : `Register New ${singular}`}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Maintain precise baselines to generate accurate COGS parameters.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ing-name" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">{singular} Name</Label>
            <Input
              id="ing-name"
              required
              placeholder="e.g., Espresso Beans, Milk, Syrup"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ing-unit" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Measured In</Label>
            <Select
              value={formData.unit_type}
              onValueChange={v => setFormData(prev => ({ ...prev, unit_type: v as UnitType }))}
            >
              <SelectTrigger id="ing-unit" className="w-full bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map(u => (
                  <SelectItem key={u.value} value={u.value}>{u.label} ({u.shortLabel})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              A liquid (oil, syrup, sauce) is Milliliters; a dry/weighed ingredient (flour, meat, rice) is Grams. Stock, alert threshold, and cost below are all in this unit — keep every recipe quantity for this {singular.toLowerCase()} in the same unit or its cost will be wrong.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ing-stock" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">
                Current Stock ({unitLabel(formData.unit_type)})
              </Label>
              <Input
                id="ing-stock"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0"
                value={formData.current_stock}
                onChange={e => setFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                className="bg-background font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ing-alert" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">
                Alert Threshold ({unitLabel(formData.unit_type)})
              </Label>
              <Input
                id="ing-alert"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="10"
                value={formData.min_stock_alert}
                onChange={e => setFormData(prev => ({ ...prev, min_stock_alert: e.target.value }))}
                className="bg-background font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ing-cost" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">
              Cost Per {unitLabel(formData.unit_type)} (₱)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₱</span>
              <Input
                id="ing-cost"
                type="number"
                step="0.0001"
                min="0"
                required
                placeholder="0.0000"
                value={formData.cost_per_unit}
                onChange={e => setFormData(prev => ({ ...prev, cost_per_unit: e.target.value }))}
                className="bg-background pl-6 font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Divide what you paid by how many {unitLabel(formData.unit_type)} it made — e.g. a ₱180 1-liter bottle of oil is ₱0.18 per ml. Small per-unit costs need the decimals: rounding to centavos here silently drops most of a bulk ingredient&apos;s real cost from every recipe that uses it.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {editingId ? 'Update Record' : `Save ${singular}`}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex h-[400px] flex-col overflow-hidden md:col-span-2 md:h-[500px]">
        <div className="flex items-center justify-between border-b bg-gradient-brand-soft p-4">
          <span className="text-xs font-semibold text-foreground">Registered Stock Catalog</span>
          <Badge variant="secondary" className="font-mono">{ingredients.length} items</Badge>
        </div>

        <div className="flex-1 divide-y overflow-y-auto">
          {ingredients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                <Soup className="size-5 text-primary" />
              </span>
              No {materialMeta.materialLabel.toLowerCase()} on file. Use the entry matrix to build your baseline ledger.
            </div>
          ) : (
            ingredients.map(ing => {
              const isLowStock = Number(ing.current_stock) <= Number(ing.min_stock_alert)

              return (
                <div key={ing.id} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-foreground">{ing.name}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        Cost: ₱{Number(ing.cost_per_unit).toFixed(4)} / {unitLabel(ing.unit_type)}
                      </span>
                      <Badge
                        variant={isLowStock ? 'destructive' : 'outline'}
                        className={isLowStock ? '' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'}
                      >
                        {ing.current_stock} {unitLabel(ing.unit_type)} remaining (Alert: {ing.min_stock_alert})
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(ing)}>Edit</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(ing.id, ing.name)}>Delete</Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Card>
  )
}
