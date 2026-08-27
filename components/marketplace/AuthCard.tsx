import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
  // Most auth screens are a short single-column form and fit the default
  // max-w-sm; register-business widens this to fit its business-type picker.
  className?: string
}) {
  return (
    <Card className={cn('w-full max-w-sm overflow-visible p-8 shadow-card-hover', className)}>
      <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-brand-soft px-2.5 py-1 label-mono text-primary">
        {eyebrow}
      </span>
      <h1 className="mb-1 font-serif text-3xl font-normal tracking-tight text-foreground">{title}</h1>
      <p className="mb-7 text-sm text-muted-foreground">{description}</p>
      {children}
      {footer && <div className="mt-6 flex justify-center gap-1 border-t pt-5 text-sm text-muted-foreground">{footer}</div>}
    </Card>
  )
}
