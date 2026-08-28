'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { OperatingExpense } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { AlertCircle, Wallet } from 'lucide-react'

type Props = {
  businessId: string
  initialExpenses: OperatingExpense[]
}

// 'YYYY-MM-DD' for today, and for the 1st of this month — matches the
// server's startOfMonth cutoff in app/sell/analytics/page.tsx, so the
// "counts this month" badge below agrees with what Analytics actually
// deducts.
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function startOfMonthStr() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const emptyForm = { title: '', description: '', amount: '', billing_period: todayStr() }

export default function ExpensesClient({ businessId, initialExpenses }: Props) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<OperatingExpense[]>(initialExpenses)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OperatingExpense | null>(null)

  const monthCutoff = startOfMonthStr()

  // What Analytics is currently deducting from net profit — same
  // >= start-of-month rule as the server query, kept in sync so this page's
  // "This Month" total always matches the Analytics OpEx card.
  const thisMonthTotal = useMemo(
    () => expenses.filter(e => e.billing_period >= monthCutoff).reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses, monthCutoff]
  )

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingId(null)
  }

  const startEdit = (exp: OperatingExpense) => {
    setEditingId(exp.id)
    setFormData({
      title: exp.title,
      description: exp.description ?? '',
      amount: String(exp.amount),
      billing_period: exp.billing_period,
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      amount: Number(formData.amount || 0),
      billing_period: formData.billing_period,
    }

    if (editingId) {
      const { data, error: uErr } = await supabase
        .from('operating_expenses')
        .update(payload)
        .eq('id', editingId)
        .select()

      if (uErr) {
        setError(uErr.message)
      } else if (data) {
        setExpenses(prev => prev.map(exp => exp.id === editingId ? data[0] : exp).sort(sortExpenses))
        toast.success('Expense updated.')
        resetForm()
      }
    } else {
      const { data, error: cErr } = await supabase
        .from('operating_expenses')
        .insert([{ ...payload, business_id: businessId }])
        .select()

      if (cErr) {
        setError(cErr.message)
      } else if (data) {
        setExpenses(prev => [...prev, data[0]].sort(sortExpenses))
        toast.success('Expense logged.')
        resetForm()
      }
    }

    setLoading(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id

    setLoading(true)
    setError(null)

    const { error: dErr } = await supabase
      .from('operating_expenses')
      .delete()
      .eq('id', id)

    if (dErr) {
      setError(dErr.message)
    } else {
      setExpenses(prev => prev.filter(exp => exp.id !== id))
      toast.success('Expense removed.')
      if (editingId === id) resetForm()
      setDeleteTarget(null)
    }
    setLoading(false)
  }

  return (
    <Card className="grid grid-cols-1 divide-y overflow-hidden py-0 md:grid-cols-3 md:divide-x md:divide-y-0">
      <div className="bg-muted/30 p-5">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          {editingId ? 'Modify Expense' : 'Log New Expense'}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          A short description helps you recognize this bill later — e.g. &quot;Meralco&quot; with &quot;March, includes late fee&quot; as the note.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="exp-title" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input
              id="exp-title"
              required
              placeholder="e.g., Rent, Meralco, Staff Wages"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="exp-description" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
            <Textarea
              id="exp-description"
              placeholder="Any detail worth remembering about this bill"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-background"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-amount" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Amount (₱)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₱</span>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="bg-background pl-6 font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-period" className="text-[11px] font-medium font-mono uppercase tracking-wider text-muted-foreground">Billing Date</Label>
              <Input
                id="exp-period"
                type="date"
                required
                value={formData.billing_period}
                onChange={e => setFormData(prev => ({ ...prev, billing_period: e.target.value }))}
                className="bg-background font-mono"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Dated within the current calendar month, this bill is subtracted automatically from Analytics&apos; net profit for that month.
          </p>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {editingId ? 'Update Expense' : 'Save Expense'}
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
        <div className="flex items-center justify-between gap-3 border-b bg-gradient-brand-soft p-4">
          <span className="text-xs font-semibold text-foreground">Expense Ledger</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{expenses.length} logged</Badge>
            <Badge className="border-amber-200 bg-amber-50 font-mono text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              ₱{thisMonthTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} this month
            </Badge>
          </div>
        </div>

        <div className="flex-1 divide-y overflow-y-auto">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                <Wallet className="size-5 text-primary" />
              </span>
              No expenses logged yet. Use the entry form to record your first bill.
            </div>
          ) : (
            expenses.map(exp => {
              const countsThisMonth = exp.billing_period >= monthCutoff

              return (
                <div key={exp.id} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-foreground">{exp.title}</h4>
                    {exp.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{exp.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        ₱{Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(exp.billing_period + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <Badge
                        variant={countsThisMonth ? 'default' : 'outline'}
                        className={countsThisMonth ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400' : ''}
                      >
                        {countsThisMonth ? 'Deducted this month' : 'Past month'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(exp)}>Edit</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(exp)}>Delete</Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title ?? ''}"?`}
        description="This can't be undone. It will also remove it from any month's net-profit calculation in Analytics."
        confirmLabel="Delete"
        loading={loading}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}

function sortExpenses(a: OperatingExpense, b: OperatingExpense) {
  if (a.billing_period !== b.billing_period) return a.billing_period > b.billing_period ? -1 : 1
  return a.created_at > b.created_at ? -1 : 1
}
