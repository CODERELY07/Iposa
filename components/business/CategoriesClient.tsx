'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StoreCategory } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Plus, Tag } from 'lucide-react'

type Props = {
  initialCategories: StoreCategory[]
  // Shared, marketplace-wide taxonomy: any approved business owner can add
  // a new category, but only a super_admin can rename or delete one —
  // otherwise one shop could break categories other shops depend on.
  canEditDelete: boolean
}

const EMPTY = { name: '' }

export default function CategoriesClient({ initialCategories, canEditDelete }: Props) {
  const supabase = createClient()
  const [categories, setCategories] = useState<StoreCategory[]>(initialCategories)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StoreCategory | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StoreCategory | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(cat: StoreCategory) {
    setEditing(cat)
    setForm({ name: cat.name })
    setError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY)
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (editing) {
      const { data, error } = await supabase
        .from('categories')
        .update({ name: form.name })
        .eq('id', editing.id)
        .select()
        .single()

      if (error) { setError(error.message); setLoading(false); return }
      setCategories(prev => prev.map(c => c.id === editing.id ? data : c))
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: form.name })
        .select()
        .single()

      if (error) { setError(error.message); setLoading(false); return }
      setCategories(prev => [data, ...prev])
    }

    setLoading(false)
    closeModal()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteId(id)
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id))
      setDeleteTarget(null)
    }
    setDeleteId(null)
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Categories</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{categories.length} total &middot; shared across the whole marketplace</p>
        </div>
        <Button onClick={openCreate} className="shrink-0 self-start sm:self-auto">
          <Plus /> Add category
        </Button>
      </div>

      <Card className="overflow-hidden py-0">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
              <Tag className="size-5 text-primary" />
            </span>
            No categories yet. Add one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-brand-soft hover:bg-gradient-brand-soft">
                <TableHead className="px-5 py-3">Name</TableHead>
                <TableHead className="px-5 py-3">Created</TableHead>
                {canEditDelete && <TableHead className="px-5 py-3" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell className="px-5 py-3.5 font-medium text-foreground">{cat.name}</TableCell>
                  <TableCell className="px-5 py-3.5 text-muted-foreground">
                    {new Date(cat.created_at).toLocaleDateString()}
                  </TableCell>
                  {canEditDelete && (
                    <TableCell className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>Edit</Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(cat)}
                          disabled={deleteId === cat.id}
                        >
                          {deleteId === cat.id ? '…' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={open => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                required
                autoFocus
                value={form.name}
                onChange={e => setForm({ name: e.target.value })}
                placeholder="e.g. Electronics"
              />
            </div>

            <DialogFooter className="-mx-4 -mb-4 border-t bg-transparent p-0 pt-4 sm:justify-stretch">
              <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Saving…' : editing ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="This category is shared across the whole marketplace — deleting it will leave any product still assigned to it uncategorized."
        confirmLabel="Delete"
        loading={deleteId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
