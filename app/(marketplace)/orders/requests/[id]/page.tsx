import { redirect } from 'next/navigation'

// Moved to its own /services/[id] page — service requests no longer live
// under /orders at all, on their own dedicated surface instead of sharing
// one page with cart orders. Kept as a redirect so an old bookmarked or
// shared link still lands somewhere.
export default async function OrderRequestRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/services/${id}`)
}
