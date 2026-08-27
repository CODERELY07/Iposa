'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, TriangleAlert } from 'lucide-react'

// A reusable confirmation modal for destructive actions (delete, void, etc.)
// — replaces the browser's native window.confirm()/alert(), which can't be
// styled, blocks the whole tab while open, and gives no room for an
// in-flight/loading state on the confirm button.
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={next => !loading && onOpenChange(next)}>
      <DialogContent className="text-center sm:max-w-sm" showCloseButton={!loading}>
        <DialogHeader className="items-center">
          {destructive && (
            <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              <TriangleAlert className="size-5" />
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={`flex-1 ${destructive ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
