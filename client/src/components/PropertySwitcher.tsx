import { Building2 } from 'lucide-react'
import { useProperty } from '@/lib/property'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const ALL = 'all'

/**
 * Admin-only. Everyone else is pinned to one property, so there is nothing to switch.
 */
export default function PropertySwitcher({ className }: { className?: string }) {
  const { properties, activeId, canSwitch, setActive } = useProperty()
  if (!canSwitch || properties.length === 0) return null

  return (
    <Select
      value={activeId ?? ALL}
      onValueChange={(v) => setActive(v === ALL ? null : v)}
    >
      <SelectTrigger className={className} aria-label="Property">
        <Building2 className="mr-2 size-4 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All properties</SelectItem>
        {properties.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
