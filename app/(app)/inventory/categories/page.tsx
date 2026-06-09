import { createClient } from '@/lib/supabase/server'
import CategoriesClient from '@/components/inventory/CategoriesClient'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg">
        Failed to load categories: {error.message}
      </div>
    )
  }

  return <CategoriesClient initialCategories={categories ?? []} />
}