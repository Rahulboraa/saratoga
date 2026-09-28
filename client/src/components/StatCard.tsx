import type { ReactNode, ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tintBg: Record<string, string> = {
  info: 'bg-info/10 text-info',
  purple: 'bg-purple/10 text-purple',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  foreground: 'bg-muted text-foreground',
}

export default function StatCard({ icon: Icon, tint = 'foreground', label, value, hint, className, to }: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  tint?: keyof typeof tintBg
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
  /** Makes the card a link to the page it summarises. */
  to?: string
}) {
  const classes = cn(
    'block rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-5',
    to && 'transition-colors hover:border-primary/40 hover:bg-accent/40',
    className,
  )

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tintBg[tint])}>
            <Icon className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="text-[13px] font-medium text-foreground">{label}</span>
      </div>
      <div className="mt-3 truncate text-xl font-semibold leading-none tracking-tight tabular-nums md:text-[26px]">{value}</div>
      <div className="mt-3 text-[12px] text-muted-foreground">{hint ?? ''}</div>
    </>
  )

  // A link rather than a click handler, so it focuses, opens in a new tab and reads as
  // navigation to a screen reader.
  return to
    ? <Link to={to} className={classes}>{body}</Link>
    : <div className={classes}>{body}</div>
}
