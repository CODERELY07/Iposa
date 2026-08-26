'use client'

import { useState, useTransition } from 'react'
import { requestPayoutAction } from '@/app/affiliate/payouts/actions'

export default function RequestPayoutButton({ disabled }: { disabled: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      const result = await requestPayoutAction()
      if (result.success) {
        setMessage({ text: 'Payout requested — the marketplace team will process it soon.', isError: false })
      } else {
        setMessage({ text: result.message, isError: true })
      }
    })
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={disabled || isPending}
        className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition cursor-pointer"
      >
        {isPending ? 'Requesting…' : 'Request payout'}
      </button>
      {message && (
        <p className={`text-xs ${message.isError ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>
      )}
    </div>
  )
}
