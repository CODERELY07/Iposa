import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-zinc-900 mb-2">404</h1>
          <p className="text-2xl font-semibold text-zinc-700">Page Not Found</p>
        </div>
        
        <p className="text-zinc-600 mb-8">
          Sorry, the page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        <div className="space-y-3">
          <Link
            href="/home"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go to Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-block w-full bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-200">
          <p className="text-sm text-zinc-500">
            Need help? <a href="/" className="text-blue-600 hover:underline">Contact support</a>
          </p>
        </div>
      </div>
    </div>
  )
}
