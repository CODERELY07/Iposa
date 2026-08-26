export default function MarketplaceFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center text-xs text-zinc-400">
        <p>&copy; {new Date().getFullYear()} IPOSA Marketplace. All rights reserved.</p>
      </div>
    </footer>
  )
}
