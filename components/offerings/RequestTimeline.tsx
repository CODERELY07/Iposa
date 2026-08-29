'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, SendHorizontal, RefreshCw, MessageCircle, DollarSign } from 'lucide-react'
import type { ServiceRequestEvent } from '@/lib/types/marketplace'

const EVENT_ICON: Record<ServiceRequestEvent['event_type'], typeof MessageCircle> = {
  submitted: MessageCircle,
  status_change: RefreshCw,
  quote_sent: DollarSign,
  comment: MessageCircle,
}

// The shared timeline + reply box behind both the customer tracking portal
// and the owner's Kanban drawer — same events, same add_request_comment()
// RPC underneath, styled relative to whichever side is looking at it.
export default function RequestTimeline({
  events,
  viewerRole,
  onComment,
  placeholder = 'Write a message…',
}: {
  events: ServiceRequestEvent[]
  viewerRole: 'business' | 'customer'
  onComment: (message: string) => Promise<{ success: boolean; message?: string }>
  placeholder?: string
}) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    const trimmed = message.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await onComment(trimmed)
      if (!result.success) {
        toast.error(result.message ?? 'Failed to send message.')
        return
      }
      setMessage('')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {events.map(event => {
          const Icon = EVENT_ICON[event.event_type] ?? MessageCircle
          const isMine = event.actor_role === viewerRole
          const isSystem = event.actor_role === 'system'
          return (
            <li key={event.id} className={isSystem ? 'flex justify-center' : `flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              {isSystem ? (
                <span className="label-mono text-muted-foreground">{event.message}</span>
              ) : (
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${isMine ? 'bg-primary text-primary-foreground' : 'border bg-card text-foreground'}`}>
                  <div className={`mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    <Icon className="size-3" />
                    {event.event_type === 'status_change'
                      ? 'Status update'
                      : event.event_type === 'quote_sent'
                        ? 'Quote'
                        // Viewer-relative, not actor-relative: the business's own
                        // sent message must read "You" in the business's own
                        // drawer, not "Shop" — "Shop"/"Customer" only label the
                        // OTHER side. Bug found testing the drawer against a real
                        // submitted request: both bubbles read "You" regardless
                        // of who actually sent them.
                        : isMine
                          ? 'You'
                          : event.actor_role === 'business' ? 'Shop' : 'Customer'}
                    <span className="ml-auto normal-case">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  {typeof event.metadata?.status === 'string' && (
                    <Badge variant="outline" className={`mb-1.5 font-mono uppercase tracking-wider ${isMine ? 'border-primary-foreground/40 text-primary-foreground' : ''}`}>
                      {String(event.metadata.status).replace(/_/g, ' ')}
                    </Badge>
                  )}
                  {typeof event.metadata?.quoted_price === 'number' && (
                    <p className="mb-1 font-mono font-bold">₱{Number(event.metadata.quoted_price).toFixed(2)}</p>
                  )}
                  {event.message && <p className="whitespace-pre-line">{event.message}</p>}
                </div>
              )}
            </li>
          )
        })}
        {events.length === 0 && <p className="text-center text-sm text-muted-foreground">No activity yet.</p>}
      </ol>

      <div className="flex items-end gap-2 border-t pt-3">
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="flex-1"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button size="icon" onClick={handleSend} disabled={isPending || !message.trim()} aria-label="Send">
          {isPending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>
    </div>
  )
}
