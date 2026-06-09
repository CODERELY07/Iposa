'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types/inventory'

type Props = { initialCategories: Category[] }

const EMPTY = { name: '' }

export default function CategoriesClient({ initialCategories }: Props) {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(cat: Category) {
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

  async function handleDelete(id: number) {
    setDeleteId(id)
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) setCategories(prev => prev.filter(c => c.id !== id))
    setDeleteId(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Categories</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{categories.length} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Add category
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">
            No categories yet. Add one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-medium text-zinc-800">{cat.name}</td>
                  <td className="px-5 py-3.5 text-zinc-400">
                    {new Date(cat.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 px-2.5 py-1 border border-zinc-200 rounded-md hover:border-zinc-300 transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        disabled={deleteId === cat.id}
                        className="text-xs text-red-500 hover:text-red-700 px-2.5 py-1 border border-red-100 rounded-md hover:border-red-200 transition cursor-pointer disabled:opacity-50"
                      >
                        {deleteId === cat.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">
              {editing ? 'Edit category' : 'New category'}
            </h2>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm({ name: e.target.value })}
                  placeholder="e.g. Electronics"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 text-sm text-zinc-600 border border-zinc-200 rounded-lg py-2.5 hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 rounded-lg py-2.5 transition cursor-pointer"
                >
                  {loading ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}