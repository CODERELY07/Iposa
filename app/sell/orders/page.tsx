import { redirect } from 'next/navigation'

// Folded into the dual-mode /sell/orders-and-requests page (POS/online
// orders are now its "Online Orders" tab, rendered via the same
// StoreOrdersClient + actions that lived here). Kept as a redirect rather
// than deleted so any existing bookmark or link to /sell/orders still lands
// somewhere useful.
export default function SellOrdersRedirect() {
  redirect('/sell/orders-and-requests')
}
