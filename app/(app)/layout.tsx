import { requireUserRole } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await requireUserRole(['admin', 'staff'])

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  )
}
