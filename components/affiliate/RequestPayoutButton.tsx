'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { requestPayoutAction } from '@/app/affiliate/payouts/actions'
import { Button } from '@/components/ui/button'
import { Landmark, Loader2 } from 'lucide-react'

export default function RequestPayoutButton({ disabled }: { disabled: boolean }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await requestPayoutAction()
      if (result.success) {
        toast.success('Payout requested — each shop will pay you in cash in person once they mark it paid.')
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Button onClick={handleClick} disabled={disabled || isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Landmark />}
      {isPending ? 'Requesting…' : 'Request payout'}
    </Button>
  )
}
