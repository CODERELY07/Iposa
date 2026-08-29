'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import MapLocationPicker from '@/components/marketplace/MapLocationPicker'
import { Loader2, MapPin, Paperclip, UploadCloud, X } from 'lucide-react'
import type { OfferingField, UploadedFile } from '@/lib/types/marketplace'

type AddressValue = { address: string; lat: number; lng: number }

// The one place offerings.metadata_schema turns into UI — used identically
// by the customer-facing DynamicOfferingRequestForm, the Offering Builder's
// live preview, and the admin drawer's read-only view of a submitted
// request. Adding a ninth field type means adding a case here (and to
// lib/offerings/field-schema.ts); nothing else in the pipeline needs to know.
export default function FieldRenderer({
  field,
  value,
  onChange,
  error,
  readOnly = false,
  onUploadFile,
}: {
  field: OfferingField
  value: unknown
  onChange?: (value: unknown) => void
  error?: string
  readOnly?: boolean
  onUploadFile?: (file: File) => Promise<UploadedFile>
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  if (readOnly) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <ReadOnlyValue field={field} value={value} />
      </div>
    )
  }

  const inputId = `field-${field.key}`

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !onUploadFile) return
    setUploadError(null)
    setUploading(true)
    try {
      const existing = Array.isArray(value) ? (value as UploadedFile[]) : []
      const room = field.max_files ? field.max_files - existing.length : Infinity
      const files = Array.from(fileList).slice(0, room)
      const uploaded = await Promise.all(files.map(onUploadFile))
      onChange?.([...existing, ...uploaded])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removeFile(index: number) {
    const existing = Array.isArray(value) ? (value as UploadedFile[]) : []
    onChange?.(existing.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>

      {field.type === 'text' && (
        <Input
          id={inputId}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={e => onChange?.(e.target.value)}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          id={inputId}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={e => onChange?.(e.target.value)}
          rows={4}
        />
      )}

      {field.type === 'number' && (
        <Input
          id={inputId}
          type="number"
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={e => onChange?.(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}

      {field.type === 'select' && (
        <Select value={(value as string) ?? undefined} onValueChange={v => onChange?.(v)}>
          <SelectTrigger id={inputId} className="w-full">
            <SelectValue placeholder="Choose one…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'multiselect' && (
        <div className="flex flex-wrap gap-3 rounded-lg border p-3">
          {(field.options ?? []).map(option => {
            const selected = Array.isArray(value) ? (value as string[]) : []
            const checked = selected.includes(option)
            return (
              <label key={option} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={c => {
                    const next = c ? [...selected, option] : selected.filter(o => o !== option)
                    onChange?.(next)
                  }}
                />
                {option}
              </label>
            )
          })}
        </div>
      )}

      {(field.type === 'date' || field.type === 'datetime') && (
        <Input
          id={inputId}
          type={field.type === 'date' ? 'date' : 'datetime-local'}
          value={(value as string) ?? ''}
          onChange={e => onChange?.(e.target.value)}
        />
      )}

      {field.type === 'file' && (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            {uploading ? <Loader2 className="size-5 animate-spin text-primary" /> : <UploadCloud className="size-5 text-primary" />}
            {uploading ? 'Uploading…' : 'Tap to choose file' + (field.max_files && field.max_files > 1 ? 's' : '')}
            {field.max_files && <span className="text-xs">Up to {field.max_files}</span>}
            <input
              id={inputId}
              type="file"
              accept={field.accept}
              multiple={(field.max_files ?? 1) > 1}
              className="hidden"
              disabled={uploading}
              onChange={e => handleFiles(e.target.files)}
            />
          </label>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          {Array.isArray(value) && value.length > 0 && (
            <ul className="space-y-1">
              {(value as UploadedFile[]).map((file, i) => (
                <li key={file.url} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
                    {file.filename}
                  </a>
                  <button type="button" onClick={() => removeFile(i)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remove file">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {field.type === 'address' && (
        <>
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setMapOpen(true)}>
            <MapPin className="size-4" />
            {(value as AddressValue)?.address || 'Drop a pin on the map'}
          </Button>
          <MapLocationPicker
            open={mapOpen}
            onOpenChange={setMapOpen}
            initialLat={(value as AddressValue)?.lat}
            initialLng={(value as AddressValue)?.lng}
            title={field.label}
            description="Search or drag the pin to the exact location."
            onConfirm={result => onChange?.(result)}
          />
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ReadOnlyValue({ field, value }: { field: OfferingField; value: unknown }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <p className="text-sm italic text-muted-foreground">Not provided</p>
  }

  if (field.type === 'file' && Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {(value as UploadedFile[]).map(file => (
          <li key={file.url}>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Paperclip className="size-3.5" /> {file.filename}
            </a>
          </li>
        ))}
      </ul>
    )
  }

  if (field.type === 'multiselect' && Array.isArray(value)) {
    return <p className="text-sm text-foreground">{(value as string[]).join(', ')}</p>
  }

  if (field.type === 'address' && typeof value === 'object') {
    const address = value as AddressValue
    return (
      <a
        href={`https://www.openstreetmap.org/?mlat=${address.lat}&mlon=${address.lng}#map=17/${address.lat}/${address.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <MapPin className="size-3.5" /> {address.address}
      </a>
    )
  }

  return <p className="whitespace-pre-line text-sm text-foreground">{String(value)}</p>
}
