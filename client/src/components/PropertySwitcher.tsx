import { Building2 } from 'lucide-react'
import { useProperty } from '@/lib/property'
import { propertyColor } from '@/lib/propertyLook'
import type { Property } from '@/types'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'

const ALL = 'all'

/** Colour chip, or the property photo when there is one. */
function Chip({ property }: { property?: Property | null }) {
  const color = propertyColor(property)
  if (property?.imageUrl) {
    return (
      <img
        src={property.imageUrl}
        alt=""
        className="size-5 shrink-0 rounded object-cover"
        style={{ outline: `1px solid ${color}` }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return <span className="size-3 shrink-0 rounded-full" style={{ background: color }} />
}

/**
 * Admin-only. Everyone else is pinned to one property, so there is nothing to switch.
 */
export default function PropertySwitcher({ className }: { className?: string }) {
  const { properties, activeId, active, canSwitch, setActive } = useProperty()
  if (!canSwitch || properties.length === 0) return null

  return (
    <Select
      value={activeId ?? ALL}
      onValueChange={(v) => setActive(v === ALL ? null : v)}
    >
      <SelectTrigger className={className} aria-label="Property">
        <span className="flex min-w-0 items-center gap-2">
          {active ? <Chip property={active} /> : <Building2 className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{active?.name ?? 'All properties'}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>
          <span className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            All properties
          </span>
        </SelectItem>
        {properties.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <Chip property={p} />
              {p.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
