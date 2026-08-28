'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { confirmOrderAction, disputeOrderAction } from '@/app/(marketplace)/orders/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CheckCircle2, Loader2 } from 'lucide-react'

// Shown on a customer's own order once the business has claimed it's done
// (status === 'awaiting_confirmation') — the confirm/dispute half of the
// completion flow in database_schema.sql SECTION 11. Confirming is the
// normal path; disputing hands it to super_admin instead of back to the
// business, and doing nothing at all still resolves it eventually via
// auto_confirm_stale_orders().
export default function OrderConfirmationActions({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [reason, setReason] = useState('')

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmOrderAction(orderId)
      if (!result.success) {
        toast.error(result.message ?? 'Failed to confirm order.')
        return
      }
      toast.success('Thanks for confirming!')
      router.refresh()
    })
  }

  function handleDispute() {
    if (!reason.trim()) return
    startTransition(async () => {
      const result = await disputeOrderAction(orderId, reason.trim())
      if (!result.success) {
        toast.error(result.message ?? 'Failed to report the problem.')
        return
      }
      toast.success('Reported — our team will review this order.')
      setDisputeOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="sm" className="flex-1" disabled={isPending} onClick={handleConfirm}>
          {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirm received
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={isPending}
          onClick={() => setDisputeOpen(true)}
        >
          Report a problem
        </Button>
      </div>

      <Dialog open={disputeOpen} onOpenChange={open => !isPending && setDisputeOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What went wrong?</DialogTitle>
            <DialogDescription>
              This sends the order to MElocalmarketplace support for review instead of marking it complete —
              they&apos;ll look at what happened and decide how it&apos;s resolved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="dispute-reason">Describe the problem</Label>
            <Textarea
              id="dispute-reason"
              rows={4}
              autoFocus
              placeholder="e.g., the repair wasn't actually finished, wrong item, never showed up…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisputeOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={isPending || !reason.trim()} onClick={handleDispute}>
              {isPending && <Loader2 className="animate-spin" />} Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
