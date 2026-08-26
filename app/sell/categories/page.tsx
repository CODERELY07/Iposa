import { createClient, requireApprovedBusiness, getCurrentUserRole } from '@/lib/supabase/server'
import CategoriesClient from '@/components/business/CategoriesClient'

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
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-6">
        Failed to load categories: {error.message}
      </div>
    )
  }

  return <CategoriesClient initialCategories={categories ?? []} canEditDelete={role === 'super_admin'} />
}
