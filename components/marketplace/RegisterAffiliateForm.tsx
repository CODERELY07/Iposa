'use client'

import { useState, useTransition } from 'react'
import { registerAffiliateAction } from '@/app/(auth)/(route group)/become-affiliate/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Banknote, Loader2 } from 'lucide-react'

export default function RegisterAffiliateForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerAffiliateAction(formData)
      // A successful call redirects server-side and never resolves here.
      if (result && !result.success) {
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

      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required placeholder="e.g., Juan Dela Cruz" />
      </div>

      {/* There's no payment gateway behind this platform — every sale is
          cash, so every commission is cash too, paid to you in person by
          whichever shop's sale you referred (see the Payouts page once
          you're approved). A phone number is all a shop needs to arrange
          the handoff — there's no GCash/bank routing to collect, since
          nothing here is ever transferred electronically. */}
      <Alert className="border-primary/20 bg-primary/5">
        <Banknote className="text-primary" />
        <AlertDescription className="text-foreground">
          Commissions are paid in <strong>cash, in person</strong>, directly by the shop whose sale you referred —
          there&apos;s no bank or e-wallet transfer. Just leave a number they can reach you on.
        </AlertDescription>
      </Alert>

      <div className="space-y-1.5">
        <Label htmlFor="payout_details">Contact phone number</Label>
        <Input id="payout_details" name="payout_details" type="tel" placeholder="e.g., 0917 123 4567" />
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}
