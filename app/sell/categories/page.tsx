import { createClient, requireApprovedBusiness, getCurrentUserRole } from '@/lib/supabase/server'
import CategoriesClient from '@/components/business/CategoriesClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default async function SellCategoriesPage() {
  await requireApprovedBusiness()
  const role = await getCurrentUserRole()
  const supabase = await createClient()

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to load categories: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return <CategoriesClient initialCategories={categories ?? []} canEditDelete={role === 'super_admin'} />
}
