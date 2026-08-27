import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-40" />

      {Array.from({ length: 2 }).map((_, g) => (
        <Card key={g} className="overflow-hidden py-0">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="flex flex-col gap-3 bg-gradient-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-10 w-full sm:w-32" />
      </Card>
    </div>
  )
}
