'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Business } from '@/lib/types/marketplace'
import { updateBusinessSettingsAction } from '@/app/sell/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function BusinessSettingsForm({ business }: { business: Business }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: business.name,
    description: business.description ?? '',
    logo_url: business.logo_url ?? '',
    banner_url: business.banner_url ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateBusinessSettingsAction({
        name: form.name,
        description: form.description || null,
        logo_url: form.logo_url || null,
        banner_url: form.banner_url || null,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      toast.success('Shop settings saved.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="shop-name">Shop name *</Label>
        <Input id="shop-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shop-description">Description</Label>
        <Textarea id="shop-description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shop-logo">Logo URL</Label>
        <Input id="shop-logo" type="url" placeholder="https://…" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shop-banner">Banner URL</Label>
        <Input id="shop-banner" type="url" placeholder="https://…" value={form.banner_url} onChange={e => setForm(f => ({ ...f, banner_url: e.target.value }))} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
