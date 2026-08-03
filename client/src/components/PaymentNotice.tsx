import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

// Set to false to remove the banner once payment is settled.
const SHOW_PAYMENT_NOTICE = false

const MESSAGE =
  'Payment for this service is pending. Access will be closed today if the outstanding amount is not settled.'

/** `bar` spans the full content width (app shell); `inline` sits inside a column. */
export default function PaymentNotice({ variant = 'bar' }: { variant?: 'bar' | 'inline' }) {
  if (!SHOW_PAYMENT_NOTICE) return null
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-destructive/20 bg-destructive/10 text-destructive',
        variant === 'bar'
          ? 'border-b px-4 py-2.5 sm:px-5 md:px-6'
          : 'rounded-lg border px-3.5 py-3',
      )}
    >
      <TriangleAlert className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
      <p className="text-[13px] leading-relaxed font-medium">{MESSAGE}</p>
    </div>
  )
}
