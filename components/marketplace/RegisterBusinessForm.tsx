'use client'

import { useState, useTransition } from 'react'
import { registerBusinessAction } from '@/app/(auth)/(route group)/register-business/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function RegisterBusinessForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
