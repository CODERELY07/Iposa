'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category } from '@/lib/types/inventory'

type Props = {
  initialProducts: Product[]
  categories: Pick<Category, 'id' | 'name'>[]
}

const EMPTY_FORM = {
  name: '',
  category_id: '',
  sku: '',
  price: '',
  stock: '0',
}

export default function ProductsClient({ initialProducts, categories }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || String(p.category_id) === filterCat
      return matchSearch && matchCat
    })
  }, [products, search, filterCat])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      sku: p.sku ?? '',
      price: String(p.price),
      stock: String(p.stock),
    })
    setError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function field(key: keyof typeof EMPTY_FORM) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      sku: form.sku || null,
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
    }

    if (editing) {
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editing.id)
        .select('*, categories(name)')
        .single()

      if (error) { setError(error.message); setLoading(false); return }
      setProducts(prev => prev.map(p => p.id === editing.id ? data : p))
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('*, categories(name)')
        .single()

      if (error) { setError(error.message); setLoading(false); return }
      setProducts(prev => [data, ...prev])
    }

    setLoading(false)
    closeModal()
  }

  async function handleDelete(id: number) {
    setDeleteId(id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) setProducts(prev => prev.filter(p => p.id !== id))
    setDeleteId(null)
  }

  const inputCls = 'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {products.length} products</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Add product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-white border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">
            {products.length === 0 ? 'No products yet. Add one to get started.' : 'No products match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {['Name', 'Category', 'SKU', 'Price', 'Stock', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition">
                    <td className="px-5 py-3.5 font-medium text-zinc-800 whitespace-nowrap">{p.name}</td>
                    <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap">
                      {p.categories?.name ? (
                        <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-full">
                          {p.categories.name}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 font-mono text-xs">{p.sku ?? '—'}</td>
                    <td className="px-5 py-3.5 text-zinc-700 whitespace-nowrap">
                      ${Number(p.price).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.stock === 0
                          ? 'bg-red-50 text-red-600'
                          : p.stock < 10
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-zinc-500 hover:text-zinc-900 px-2.5 py-1 border border-zinc-200 rounded-md hover:border-zinc-300 transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleteId === p.id}
                          className="text-xs text-red-500 hover:text-red-700 px-2.5 py-1 border border-red-100 rounded-md hover:border-red-200 transition cursor-pointer disabled:opacity-50"
                        >
                          {deleteId === p.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-zinc-900 mb-5">
              {editing ? 'Edit product' : 'New product'}
            </h2>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Name <span className="text-red-400">*</span></label>
                <input type="text" required autoFocus placeholder="Product name" {...field('name')} className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">Category</label>
                <select {...field('category_id')} className={inputCls}>
                  <option value="">No category</option>
                  {categories.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">SKU</label>
                <input type="text" placeholder="ABC-001" {...field('sku')} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Price <span className="text-red-400">*</span></label>
                  <input type="number" required min="0" step="0.01" placeholder="0.00" {...field('price')} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Stock</label>
                  <input type="number" min="0" step="1" placeholder="0" {...field('stock')} className={inputCls} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
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