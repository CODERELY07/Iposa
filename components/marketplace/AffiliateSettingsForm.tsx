'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAffiliateSettingsAction } from '@/app/sell/settings/actions'
import type { BusinessAffiliateSettings } from '@/lib/types/marketplace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function AffiliateSettingsForm({ settings }: { settings: BusinessAffiliateSettings | null }) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [rate, setRate] = useState(String(settings?.commission_rate ?? 5))
  const [serviceAmount, setServiceAmount] = useState(String(settings?.service_commission_amount ?? 0))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateAffiliateSettingsAction({
        enabled,
        commission_rate: Number(rate),
        service_commission_amount: Number(serviceAmount),
      })
      if (result.success) {
        toast.success('Affiliate settings saved.')
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Label className="flex w-fit items-center gap-2.5 font-medium">
        <Checkbox checked={enabled} onCheckedChange={value => setEnabled(value === true)} />
        Let affiliates promote my shop
      </Label>

      <div className="space-y-1.5">
        <Label htmlFor="commission_rate">Product commission rate (%)</Label>
        <Input
          id="commission_rate"
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={rate}
          onChange={e => setRate(e.target.value)}
          disabled={!enabled}
          className="w-32"
        />
        <p className="text-[11px] text-muted-foreground">
          Paid to an affiliate out of your profit (selling price minus item cost), not your revenue — e.g. a ₱29
          item with ₱15 profit and a 10% rate pays the affiliate ₱1.50, not ₱2.90. Applies to products bought
          through the cart.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="service_commission_amount">Service request commission (fixed ₱ amount)</Label>
        <Input
          id="service_commission_amount"
          type="number"
          min={0}
          step="1"
          value={serviceAmount}
          onChange={e => setServiceAmount(e.target.value)}
          disabled={!enabled}
          className="w-32"
        />
        <p className="text-[11px] text-muted-foreground">
          A flat peso amount, not a percentage — custom offerings (quotes, bookings, repairs) have no per-item cost
          to take a cut of, so you name a fixed price instead. Paid once, when you mark a request an affiliate
          referred as completed. ₱0 means shareable but pays nothing.
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
