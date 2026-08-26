import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import IngredientsClient from '@/components/business/IngredientsClient'

export const revalidate = 0

export default async function SellIngredientsPage() {
  const business = await requireApprovedBusiness()
  const supabase = await createClient()

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('business_id', business.id)
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-lg">
        Failed to fetch ingredients catalog: {error.message}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Ingredients</h1>
        <p className="text-sm text-zinc-500">Configure raw stock components and baseline costs for your recipes.</p>
      </div>

      <IngredientsClient businessId={business.id} initialIngredients={ingredients ?? []} />
    </div>
  )
}
