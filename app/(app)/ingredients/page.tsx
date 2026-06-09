import IngredientsClient from '@/components/inventory/IngredientsClient'
import { createClient } from '@/lib/supabase/server'


export const revalidate = 0

export default async function IngredientsPage() {
  const supabase = await createClient()

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-lg">
        Failed to fetch ingredients catalog: {error.message}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Ingredients Catalog</h1>
        <p className="text-sm text-zinc-500">Configure base matrix elements and baseline costs.</p>
      </div>
      
      <IngredientsClient initialIngredients={ingredients ?? []} />
    </div>
  )
}