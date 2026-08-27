import { createClient, requireApprovedBusiness } from '@/lib/supabase/server'
import IngredientsClient from '@/components/business/IngredientsClient'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Soup } from 'lucide-react'

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
      <Alert variant="destructive" className="m-6">
        <AlertCircle />
        <AlertDescription>Failed to fetch ingredients catalog: {error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--brand-pink),transparent_88%)] text-[color:var(--brand-pink)]">
          <Soup className="size-5" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Ingredients</h1>
          <p className="text-sm text-muted-foreground">Configure raw stock components and baseline costs for your recipes.</p>
        </div>
      </div>

      <IngredientsClient businessId={business.id} initialIngredients={ingredients ?? []} />
    </div>
  )
}
