import { Card, CardContent } from '@/components/ui/card'
import type { ReactNode } from 'react'

export default function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-xl font-bold md:text-2xl">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}
