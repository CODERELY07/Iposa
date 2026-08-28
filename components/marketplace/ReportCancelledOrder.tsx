'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { reportCancelledOrderAction } from '@/app/(marketplace)/orders/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Flag, Loader2 } from 'lucide-react'

// Shown on a customer's own cancelled order — the cheapest, most reliable
// signal a platform without a payment gateway can get that a business
// cancelled in-system while still delivering off-system: the customer
// already has the goods, so they have no incentive to lie about this.
// Reuses the same admin dispute pipeline as OrderConfirmationActions'
// "Report a problem" — see report_cancelled_order() in database_schema.sql.
export default function ReportCancelledOrder({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  function handleSubmit() {
    if (!reason.trim()) return
    startTransition(async () => {
      const result = await reportCancelledOrderAction(orderId, reason.trim())
      if (!result.success) {
        toast.error(result.message ?? 'Failed to report this order.')
        return
      }
      toast.success('Reported — our team will review this order.')
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Flag /> Actually received this?
      </Button>

      <Dialog open={open} onOpenChange={o => !isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this cancelled order</DialogTitle>
            <DialogDescription>
              This tells MElocalmarketplace support that you received this order despite it showing cancelled — they&apos;ll
              look into it instead of leaving it as-is.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="cancelled-report-reason">What happened?</Label>
            <Textarea
              id="cancelled-report-reason"
              rows={4}
              autoFocus
              placeholder="e.g., it was delivered/picked up after this was marked cancelled…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending || !reason.trim()} onClick={handleSubmit}>
              {isPending && <Loader2 className="animate-spin" />} Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
