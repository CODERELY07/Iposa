'use client'

import { voidTransactionAction } from '@/app/sell/sales-history/actions'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock } from 'lucide-react'

type ModalProps = {
  saleId: number
  onSuccess: () => void
  onCancel: () => void
}

export default function PinVerificationModal({ saleId, onSuccess, onCancel }: ModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleAuthorizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 4) return setError('PIN must contain exactly 4 numeric characters.')

    setError('')
    setProcessing(true)

    const outcome = await voidTransactionAction(saleId, pin)

    if (!outcome.success) {
      setError(outcome.message)
      setPin('')
      setProcessing(false)
    } else {
      toast.success(outcome.message)
      onSuccess()
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="text-center sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            <Lock className="size-5" />
          </div>
          <DialogTitle>Confirm Void</DialogTitle>
          <DialogDescription>Enter your PIN to confirm this transaction should be voided.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAuthorizationSubmit} className="space-y-4">
          <Input
            type="password"
            maxLength={4}
            pattern="\d*"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="mx-auto w-32 text-center font-mono text-2xl font-black tracking-widest"
            placeholder="••••"
            disabled={processing}
            autoFocus
          />

          {error && (
            <p className="rounded-lg border border-red-100/50 bg-red-50 p-2 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}

          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0 sm:justify-center">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="flex-1 bg-red-600 text-white hover:bg-red-700" disabled={processing || pin.length !== 4}>
              {processing ? 'Processing...' : 'Void Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
