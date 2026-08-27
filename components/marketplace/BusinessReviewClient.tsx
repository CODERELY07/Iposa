'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { reviewBusinessAction, changeBusinessTypeAction } from '@/app/admin/businesses/actions'
import type { Business, BusinessType } from '@/lib/types/marketplace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApplicationStatusBadge } from '@/components/marketplace/StatusBadge'
import { BUSINESS_TYPE_OPTIONS, getBusinessTypeMeta } from '@/lib/business/type-meta'
import { Store } from 'lucide-react'

export default function BusinessReviewClient({ businesses }: { businesses: Business[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  // Local optimistic override so the select reflects a just-saved change
  // immediately, keyed by business id — the list itself only refreshes via
  // revalidatePath on the next navigation.
  const [typeOverrides, setTypeOverrides] = useState<Record<string, BusinessType>>({})
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null)

  function approve(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewBusinessAction(id, 'approved')
      if (!result.success) toast.error(result.message)
      setBusyId(null)
    })
  }

  function reject(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const result = await reviewBusinessAction(id, 'rejected', reason)
      if (!result.success) toast.error(result.message)
      setBusyId(null)
      setRejectingId(null)
      setReason('')
    })
  }

  function changeType(business: Business, type: BusinessType) {
    if (type === (typeOverrides[business.id] ?? business.business_type)) return
    setPendingTypeId(business.id)
    startTransition(async () => {
      const result = await changeBusinessTypeAction(business.id, type)
      if (!result.success) {
        toast.error(result.message)
      } else {
        setTypeOverrides(prev => ({ ...prev, [business.id]: type }))
        toast.success(`${business.name} switched to ${getBusinessTypeMeta(type).shortLabel}.`)
      }
      setPendingTypeId(null)
    })
  }

  return (
    <div className="space-y-4">
      {businesses.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand-soft">
            <Store className="size-5 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">No business applications yet.</p>
        </div>
      )}

      {businesses.map(b => {
        const currentType = typeOverrides[b.id] ?? b.business_type

        return (
        <Card key={b.id} className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">{b.name}</h3>
                <ApplicationStatusBadge status={b.status} />
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{b.slug}</p>
              {b.description && <p className="mt-2 max-w-xl text-sm text-foreground">{b.description}</p>}
              {b.status === 'rejected' && b.rejection_reason && (
                <p className="mt-2 text-xs text-destructive">Reason: {b.rejection_reason}</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Submitted {new Date(b.created_at).toLocaleString()}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Business type</span>
                <Select
                  value={currentType}
                  onValueChange={v => changeType(b, v as BusinessType)}
                  disabled={isPending && pendingTypeId === b.id}
                >
                  <SelectTrigger size="sm" className="w-44 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.shortLabel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {b.status === 'pending' && (
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={isPending && busyId === b.id} onClick={() => approve(b.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectingId(rejectingId === b.id ? null : b.id)}>
                    Reject
                  </Button>
                </div>
                {rejectingId === b.id && (
                  <div className="flex w-full max-w-64 items-start gap-2">
                    <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 text-xs" />
                    <Button size="sm" variant="destructive" disabled={isPending && busyId === b.id} onClick={() => reject(b.id)}>
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
        )
      })}
    </div>
  )
}
