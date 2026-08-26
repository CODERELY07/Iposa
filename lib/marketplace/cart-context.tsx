'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CartItem } from '@/lib/types/marketplace'

const STORAGE_KEY = 'iposa.marketplace.cart'

type CartContextValue = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  removeItem: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  clear: () => void
  totalItems: number
  totalPrice: number
  // Cart items grouped by shop, since checkout splits into one order per business.
  groupedByBusiness: { businessId: string; businessName: string; items: CartItem[]; subtotal: number }[]
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // One-time hydration from localStorage after mount, so the server-
    // rendered markup (which has no access to the browser's storage) and
    // the client's first render match, avoiding a hydration mismatch.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // corrupt/blocked storage — start with an empty cart
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // storage unavailable — cart just won't persist across reloads
    }
  }, [items, hydrated])

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId)
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            // A fresh referral tag on a repeat add takes precedence (it's the
            // most recent "Add to Cart"/"Buy Now" action); adding again with
            // no ref never erases a referral credit already earned earlier.
            ? { ...i, quantity: i.quantity + quantity, refCode: item.refCode ?? i.refCode }
            : i
        )
      }
      return [...prev, { ...item, quantity }]
    })
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const setQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.productId !== productId))
      return
    }
    setItems(prev => prev.map(i => (i.productId === productId ? { ...i, quantity } : i)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items])

  const groupedByBusiness = useMemo(() => {
    const groups = new Map<string, { businessId: string; businessName: string; items: CartItem[]; subtotal: number }>()
    for (const item of items) {
      const group = groups.get(item.businessId) ?? {
        businessId: item.businessId,
        businessName: item.businessName,
        items: [],
        subtotal: 0,
      }
      group.items.push(item)
      group.subtotal += item.price * item.quantity
      groups.set(item.businessId, group)
    }
    return Array.from(groups.values())
  }, [items])

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQuantity, clear, totalItems, totalPrice, groupedByBusiness }),
    [items, addItem, removeItem, setQuantity, clear, totalItems, totalPrice, groupedByBusiness]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
