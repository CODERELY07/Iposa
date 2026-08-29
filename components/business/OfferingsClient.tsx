'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Offering, OfferingField, OfferingFieldType, StoreCategory, FulfillmentType } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import FieldRenderer from '@/components/offerings/FieldRenderer'
import { FIELD_TYPES, slugifyFieldKey } from '@/lib/offerings/field-schema'
import { AlertCircle, Plus, Sparkles, Package, Trash2, Pencil, GripVertical, Info } from 'lucide-react'

type OfferingRow = Offering & { categories: { name: string } | null }

const FULFILLMENT_PRESETS: { value: FulfillmentType; label: string }[] = [
  { value: 'approval_required', label: 'Approval required' },
  { value: 'file_upload_request', label: 'File upload request' },
  { value: 'time_slot_booking', label: 'Time-slot booking' },
]
const CUSTOM_PRESET = '__custom__'

type OfferingPayload = {
  id: number | null
  name: string
  category_id: number | null
  description: string | null
  image_url: string | null
  fulfillment_type: FulfillmentType
  price: number | null
  price_label: string | null
  metadata_schema: OfferingField[]
  is_active: boolean
  sort_order: number
}

const EMPTY_FORM = {
  name: '',
  category_id: '',
  description: '',
  image_url: '',
  fulfillment_type: 'approval_required' as string,
  customFulfillmentType: '',
  priceMode: 'fixed' as 'fixed' | 'quote',
  price: '',
  price_label: '',
  is_active: true,
  sort_order: '0',
}

const NO_CATEGORY = '__none__'

async function fakeUpload(file: File) {
  // Builder preview only — never persisted. A real upload zone belongs on
  // the actual customer-facing form, which uses the real server action.
  return { url: URL.createObjectURL(file), filename: file.name, uploaded_at: new Date().toISOString() }
}

export default function OfferingsClient({
  initialOfferings,
  categories,
  onSaveAction,
  onDeleteAction,
}: {
  initialOfferings: OfferingRow[]
  categories: StoreCategory[]
  onSaveAction: (payload: OfferingPayload) => Promise<void>
  onDeleteAction: (id: number) => Promise<void>
}) {
  const [offerings, setOfferings] = useState(initialOfferings)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fields, setFields] = useState<OfferingField[]>([])
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({})
  const [deleteTarget, setDeleteTarget] = useState<OfferingRow | null>(null)

  const posOfferings = useMemo(() => offerings.filter(o => o.requires_pos), [offerings])
  const customOfferings = useMemo(() => offerings.filter(o => !o.requires_pos), [offerings])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFields([])
    setPreviewData({})
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(offering: OfferingRow) {
    const preset = FULFILLMENT_PRESETS.some(p => p.value === offering.fulfillment_type)
    setEditingId(offering.id)
    setForm({
      name: offering.name,
      category_id: offering.category_id ? String(offering.category_id) : '',
      description: offering.description ?? '',
      image_url: offering.image_url ?? '',
      fulfillment_type: preset ? offering.fulfillment_type : CUSTOM_PRESET,
      customFulfillmentType: preset ? '' : offering.fulfillment_type,
      priceMode: offering.price != null ? 'fixed' : 'quote',
      price: offering.price != null ? String(offering.price) : '',
      price_label: offering.price_label ?? '',
      is_active: offering.is_active,
      sort_order: String(offering.sort_order ?? 0),
    })
    setFields(offering.metadata_schema ?? [])
    setPreviewData({})
    setError(null)
    setDialogOpen(true)
  }

  function addField() {
    setFields(prev => [...prev, { key: `field_${prev.length + 1}`, label: '', type: 'text', required: false }])
  }

  function updateField(index: number, patch: Partial<OfferingField>) {
    setFields(prev => prev.map((f, i) => {
      if (i !== index) return f
      const next = { ...f, ...patch }
      // Re-derive the key from the label unless the field already has a
      // hand-edited one — keeps form_data keys stable once a request has
      // actually been submitted against this schema.
      if (patch.label !== undefined) {
        next.key = slugifyFieldKey(patch.label)
      }
      return next
    }))
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    const fulfillmentType = form.fulfillment_type === CUSTOM_PRESET ? form.customFulfillmentType.trim() : form.fulfillment_type
    if (!fulfillmentType) {
      setError('Fulfillment type is required.')
      return
    }
    if (form.priceMode === 'fixed' && form.price.trim() === '') {
      setError('Set a price, or switch to "Quote on request".')
      return
    }
    const cleanFields = fields.filter(f => f.label.trim())
    if (fields.some(f => !f.label.trim())) {
      setError('Every field needs a label — remove any empty rows.')
      return
    }

    const payload: OfferingPayload = {
      id: editingId,
      name: form.name.trim(),
      category_id: form.category_id && form.category_id !== NO_CATEGORY ? Number(form.category_id) : null,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      fulfillment_type: fulfillmentType,
      price: form.priceMode === 'fixed' ? Number(form.price) : null,
      price_label: form.price_label.trim() || null,
      metadata_schema: cleanFields,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    }

    startTransition(async () => {
      try {
        await onSaveAction(payload)
        toast.success(editingId ? 'Offering updated' : 'Offering created')
        setDialogOpen(false)
        // Optimistic local patch keeps the table responsive without waiting
        // on the server round-trip; the page's own revalidation on next
        // navigation reconciles anything this can't fully know (like the
        // new row's id) on create.
        if (editingId) {
          setOfferings(prev => prev.map(o => (o.id === editingId ? { ...o, ...payload, categories: null } as OfferingRow : o)))
        } else {
          window.location.reload()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save offering.')
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      try {
        await onDeleteAction(target.id)
        setOfferings(prev => prev.filter(o => o.id !== target.id))
        toast.success('Offering deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete offering.')
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Offerings</h1>
          <p className="text-sm text-muted-foreground">
            Everything customers see on your storefront — retail products flow in automatically from{' '}
            <a href="/sell/products" className="text-primary hover:underline">Products</a>; build anything else here.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> New custom offering
        </Button>
      </div>

      {customOfferings.length === 0 && (
        <Card className="mb-6 flex flex-col items-center gap-2 border-dashed p-10 text-center">
          <Sparkles className="size-6 text-primary" />
          <p className="text-sm font-medium text-foreground">No custom offerings yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Repairs, printing jobs, loan applications, bookings — anything that isn&apos;t a cart checkout. Customers fill out a form you design; no POS, no payment step.
          </p>
        </Card>
      )}

      {customOfferings.length > 0 && (
        <OfferingsTable
          title="Custom offerings"
          rows={customOfferings}
          onEdit={openEdit}
          onDelete={row => setDeleteTarget(row)}
        />
      )}

      {posOfferings.length > 0 && (
        <div className="mt-8">
          <h2 className="label-mono mb-2 flex items-center gap-1.5"><Package className="size-3.5" /> Retail products (POS)</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Mirrored automatically from your product catalog — edit these on the{' '}
            <a href="/sell/products" className="text-primary hover:underline">Products</a> page.
          </p>
          <OfferingsTable title="" rows={posOfferings} readOnly />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit offering' : 'New custom offering'}</DialogTitle>
            <DialogDescription>Customers request this — it never enters the cart or POS.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="of-name">Name</Label>
                <Input id="of-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Phone Screen Repair" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="of-desc">Description</Label>
                <Textarea id="of-desc" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="of-image">Image URL</Label>
                <Input id="of-image" type="url" placeholder="https://…" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category_id || NO_CATEGORY} onValueChange={v => setForm(f => ({ ...f, category_id: String(v ?? '') }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fulfillment type</Label>
                  <Select value={form.fulfillment_type} onValueChange={v => setForm(f => ({ ...f, fulfillment_type: String(v ?? '') }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FULFILLMENT_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      <SelectItem value={CUSTOM_PRESET}>Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.fulfillment_type === CUSTOM_PRESET && (
                <Input
                  placeholder="e.g. pa_utang_application"
                  value={form.customFulfillmentType}
                  onChange={e => setForm(f => ({ ...f, customFulfillmentType: e.target.value }))}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pricing</Label>
                  <Select value={form.priceMode} onValueChange={v => setForm(f => ({ ...f, priceMode: v as 'fixed' | 'quote' }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed price</SelectItem>
                      <SelectItem value="quote">Quote on request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.priceMode === 'fixed' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="of-price">Price (₱)</Label>
                    <Input id="of-price" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="of-price-label">Label</Label>
                    <Input id="of-price-label" placeholder="e.g. Contact for quote" value={form.price_label} onChange={e => setForm(f => ({ ...f, price_label: e.target.value }))} />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_active} onCheckedChange={c => setForm(f => ({ ...f, is_active: Boolean(c) }))} />
                Visible on storefront
              </label>

              <Separator />

              <div className="flex items-center justify-between">
                <Label>Request fields</Label>
                <Button type="button" size="sm" variant="outline" onClick={addField}>
                  <Plus className="size-3.5" /> Add field
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  No fields yet — customers will just see a notes box. Add a field for anything specific you need to know.
                </p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <FieldEditorRow key={index} field={field} onChange={patch => updateField(index, patch)} onRemove={() => removeField(index)} />
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-0 lg:self-start">
              <p className="label-mono mb-2 flex items-center gap-1.5"><Info className="size-3" /> Customer preview</p>
              <p className="mb-2 text-xs text-muted-foreground">This is the form the customer fills out — admin-only fields aren&apos;t part of it. They&apos;ll see the value on their tracking page once you set it.</p>
              <Card className="space-y-4 p-4">
                {fields.filter(f => f.label.trim() && !f.admin_only).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add a customer-visible field to see it here.</p>
                ) : (
                  fields.filter(f => f.label.trim() && !f.admin_only).map(field => (
                    <FieldRenderer
                      key={field.key}
                      field={field}
                      value={previewData[field.key]}
                      onChange={v => setPreviewData(prev => ({ ...prev, [field.key]: v }))}
                      onUploadFile={fakeUpload}
                    />
                  ))
                )}
              </Card>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="lg:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save offering'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete this offering?"
        description={`"${deleteTarget?.name}" will no longer appear on your storefront. This can't be undone.`}
        confirmLabel="Delete"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function OfferingsTable({
  title,
  rows,
  readOnly = false,
  onEdit,
  onDelete,
}: {
  title: string
  rows: OfferingRow[]
  readOnly?: boolean
  onEdit?: (row: OfferingRow) => void
  onDelete?: (row: OfferingRow) => void
}) {
  return (
    <Card className="overflow-hidden py-0">
      {title && <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">{title}</div>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            {!readOnly && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className={row.requires_pos ? 'font-mono uppercase tracking-wider text-muted-foreground' : 'border-primary/30 font-mono uppercase tracking-wider text-primary'}>
                  {row.requires_pos ? 'POS' : 'Request'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.fulfillment_type.replace(/_/g, ' ')}</TableCell>
              <TableCell className="font-mono text-sm">
                {row.price != null ? `₱${Number(row.price).toFixed(2)}` : (row.price_label || 'Quote')}
              </TableCell>
              <TableCell>
                <Badge variant={row.is_active ? 'outline' : 'secondary'} className={row.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400' : ''}>
                  {row.is_active ? 'Active' : 'Hidden'}
                </Badge>
              </TableCell>
              {!readOnly && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit?.(row)} aria-label="Edit"><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onDelete?.(row)} aria-label="Delete"><Trash2 /></Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function FieldEditorRow({
  field,
  onChange,
  onRemove,
}: {
  field: OfferingField
  onChange: (patch: Partial<OfferingField>) => void
  onRemove: () => void
}) {
  return (
    <Card className="space-y-2.5 p-3">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground/50" />
        <Input placeholder="Field label, e.g. Device model" value={field.label} onChange={e => onChange({ label: e.target.value })} className="flex-1" />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove field"><Trash2 /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2 pl-6">
        <Select value={field.type} onValueChange={v => onChange({ type: v as OfferingFieldType })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {!field.admin_only && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={field.required} onCheckedChange={c => onChange({ required: Boolean(c) })} />
            Required
          </label>
        )}
      </div>
      <label className="flex items-start gap-2 pl-6 text-sm text-muted-foreground">
        <Checkbox
          checked={Boolean(field.admin_only)}
          onCheckedChange={c => onChange({ admin_only: Boolean(c), required: c ? false : field.required })}
          className="mt-0.5"
        />
        <span>
          Admin only
          <span className="block text-xs text-muted-foreground/80">Not part of the customer&apos;s form — you fill it in from the request&apos;s drawer. The customer sees the value once you&apos;ve set it.</span>
        </span>
      </label>

      {(field.type === 'select' || field.type === 'multiselect') && (
        <Input
          placeholder="Options, comma separated"
          className="ml-6 w-[calc(100%-1.5rem)]"
          value={(field.options ?? []).join(', ')}
          onChange={e => onChange({ options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        />
      )}
      {field.type === 'number' && (
        <div className="ml-6 grid w-[calc(100%-1.5rem)] grid-cols-2 gap-2">
          <Input type="number" placeholder="Min (optional)" value={field.min ?? ''} onChange={e => onChange({ min: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <Input type="number" placeholder="Max (optional)" value={field.max ?? ''} onChange={e => onChange({ max: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
      )}
      {field.type === 'file' && (
        <div className="ml-6 grid w-[calc(100%-1.5rem)] grid-cols-2 gap-2">
          <Input type="number" min="1" placeholder="Max files" value={field.max_files ?? ''} onChange={e => onChange({ max_files: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <Input placeholder="Accept, e.g. image/*" value={field.accept ?? ''} onChange={e => onChange({ accept: e.target.value || undefined })} />
        </div>
      )}
    </Card>
  )
}
