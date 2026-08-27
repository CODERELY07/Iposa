'use client'

import { useState, useTransition } from 'react'
import { registerAffiliateAction } from '@/app/(auth)/(route group)/become-affiliate/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

// Plain native <select> (not the shadcn Select) so its value keeps reading
// straight out of FormData in the server action — styled to match anyway.
const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

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

      <div className="space-y-1.5">
        <Label htmlFor="payout_method">Payout method</Label>
        <select id="payout_method" name="payout_method" className={selectClass}>
          <option value="GCash">GCash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="PayMaya">PayMaya</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payout_details">Payout details</Label>
        <Textarea id="payout_details" name="payout_details" rows={2} placeholder="Account name and number" />
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}
