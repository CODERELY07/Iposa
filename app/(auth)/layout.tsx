import type { Metadata } from 'next'
 
export const metadata: Metadata = { title: 'Auth' }
 
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      {children}
    </div>
  )
}
 
