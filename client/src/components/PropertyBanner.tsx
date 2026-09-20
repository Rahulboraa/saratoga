import { Building2 } from 'lucide-react'
import { useProperty } from '@/lib/property'
import { propertyColor } from '@/lib/propertyLook'

/**
 * A standing reminder of which property is being worked on. Sits above the page content
 * rather than behind it, so it is unmissable without competing with the figures.
 */
export default function PropertyBanner() {
  const { active, canSwitch, properties } = useProperty()
  // Nothing to be confused about until there is more than one property.
  if (properties.length < 2 && !active?.imageUrl) return null

  if (!active) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-2.5 print:hidden">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <div className="text-[13px] font-medium text-muted-foreground">
          All properties — combined view.{canSwitch && ' Pick one above before adding anything.'}
        </div>
      </div>
    )
  }

  const color = propertyColor(active)
  return (
    <div
      className="relative mb-5 overflow-hidden rounded-xl border border-border/60 print:hidden"
      style={{ background: color }}
    >
      {active.imageUrl && (
        <img
          src={active.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      {/* Keeps the text readable whatever the photo behind it looks like. */}
      <div
        className="relative flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(90deg, ${color}e6 0%, ${color}99 45%, ${color}33 100%)` }}
      >
        <Building2 className="size-5 shrink-0 text-white/90" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-white drop-shadow-sm">{active.name}</div>
          {active.location && (
            <div className="truncate text-[12px] text-white/80 drop-shadow-sm">{active.location}</div>
          )}
        </div>
      </div>
    </div>
  )
}
