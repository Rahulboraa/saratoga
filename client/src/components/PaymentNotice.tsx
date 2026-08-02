import { TriangleAlert } from 'lucide-react'

// Set to false to remove the banner once payment is settled.
const SHOW_PAYMENT_NOTICE = true

export default function PaymentNotice() {
  if (!SHOW_PAYMENT_NOTICE) return null
  return (
    <div className="flex items-start gap-2.5 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-destructive sm:px-5 md:px-6">
      <TriangleAlert className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
      <p className="text-[13px] leading-relaxed font-medium">
        Payment for this service is pending. Access will be closed today if the
        outstanding amount is not settled.
      </p>
    </div>
  )
}
