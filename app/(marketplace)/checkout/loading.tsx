import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <Card className="space-y-4 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-16 w-full rounded-xl" />
      </Card>
    </div>
  )
}
