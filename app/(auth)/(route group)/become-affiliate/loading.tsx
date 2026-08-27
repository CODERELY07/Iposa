import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <Card className="w-full max-w-sm space-y-5 overflow-visible p-8 shadow-card-hover">
      <Skeleton className="h-6 w-36 rounded-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11.5 w-full rounded-[9px]" />
    </Card>
  )
}
