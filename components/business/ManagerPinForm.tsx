'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateManagerPinAction } from '@/app/sell/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function ManagerPinForm() {
  const [isPending, startTransition] = useTransition()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateManagerPinAction(pin)
      if (!result.success) {
        setError(result.message)
        return
      }
      setPin('')
      toast.success('PIN updated.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xs space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="manager-pin">4-digit PIN</Label>
        <Input
          id="manager-pin"
          type="password"
          maxLength={4}
          pattern="\d*"
          inputMode="numeric"
          required
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className="w-32 text-center font-mono text-lg tracking-widest"
        />
      </div>

      <Button type="submit" disabled={isPending || pin.length !== 4}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Saving…' : 'Save PIN'}
      </Button>
    </form>
  )
}
