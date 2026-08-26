'use client'

import { voidTransactionAction } from '@/app/sell/sales-history/actions'
import { useState } from 'react'

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
      alert(outcome.message)
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white border border-zinc-200 shadow-2xl rounded-2xl max-w-sm w-full p-6 text-center animate-scale-in">
        <div className="w-11 h-11 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-base mb-3 border border-red-100">
          🔒
        </div>
        <h3 className="text-sm font-bold text-zinc-900">Confirm Void</h3>
        <p className="text-[11px] text-zinc-400 mt-0.5 mb-4">Enter your PIN to confirm this transaction should be voided.</p>

        <form onSubmit={handleAuthorizationSubmit} className="space-y-4">
          <input
            type="password"
            maxLength={4}
            pattern="\d*"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-32 mx-auto text-center font-mono text-2xl font-black tracking-widest border border-zinc-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl p-2 bg-zinc-50"
            placeholder="••••"
            disabled={processing}
            autoFocus
          />

          {error && (
            <p className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100/50 p-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition hover:bg-zinc-50"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              disabled={processing || pin.length !== 4}
            >
              {processing ? 'Processing...' : 'Void Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
