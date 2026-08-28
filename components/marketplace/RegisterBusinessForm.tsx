'use client'

import { useState, useTransition } from 'react'
import { registerBusinessAction } from '@/app/(auth)/(route group)/register-business/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, Check } from 'lucide-react'
import { BUSINESS_TYPE_OPTIONS, getBusinessTypeMeta } from '@/lib/business/type-meta'
import type { BusinessType } from '@/lib/types/marketplace'

export default function RegisterBusinessForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [businessType, setBusinessType] = useState<BusinessType>('retail')
  const selectedMeta = getBusinessTypeMeta(businessType)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerBusinessAction(formData)
      // A successful call redirects server-side and never resolves here.
      if (result && !result.success) {
        setError(result.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>What kind of business is this? *</Label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {BUSINESS_TYPE_OPTIONS.map(opt => {
            const Icon = opt.Icon
            const active = businessType === opt.value
            return (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-all ${
                  active
                    ? 'border-primary/60 bg-gradient-brand-soft shadow-glow-primary'
                    : 'border-input bg-background hover:border-primary/40'
                }`}
              >
                <input
                  type="radio"
                  name="business_type"
                  value={opt.value}
                  checked={active}
                  onChange={() => setBusinessType(opt.value)}
                  className="sr-only"
                  required
                />
                <span className={`flex size-8 items-center justify-center rounded-lg ${active ? 'bg-gradient-brand text-white' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{opt.shortLabel}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{opt.tagline}</span>
                {active && <Check className="absolute right-2.5 top-2.5 size-4 text-primary" />}
              </label>
            )
          })}
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          {selectedMeta.description} <span className="font-medium text-foreground">{selectedMeta.costingSummary}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Shop name</Label>
        <Input id="name" name="name" required placeholder="e.g., Maria's Bakeshop" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Tell customers about your shop</Label>
        <Textarea id="description" name="description" rows={3} placeholder="What do you sell?" />
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}
