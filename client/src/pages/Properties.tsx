import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { ManagedUser, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

export default function Properties() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<Property[]>('/properties'),
  })
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<ManagedUser[]>('/users'),
  })

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['properties'] })

  const createProperty = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/properties', { body }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      toast.success('Property added')
    },
    onError,
  })

  const updateProperty = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/properties/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
    onError,
  })

  const deleteProperty = useMutation({
    mutationFn: (id: string) => api(`/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Property removed')
    },
    onError,
  })

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createProperty.mutate({ name: fd.get('name'), location: fd.get('location') })
  }

  const staffCount = (id: string) => (users ?? []).filter((u) => u.propertyId === id).length

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Each property keeps its own bookings, expenses, leads and staff"
        actions={<Button onClick={() => setAddOpen(true)}>Add property</Button>}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (properties ?? []).length === 0 ? (
        <EmptyState icon={Building2} message="No properties yet" description="Add one to start recording bookings against it." />
      ) : (
        <div className="divide-y rounded-xl border border-border/60 bg-card shadow-sm">
          {(properties ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{p.name}</span>
                    {!p.active && <Badge variant="destructive" withDot>inactive</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {p.location || 'No location set'} · {staffCount(p.id)} user{staffCount(p.id) === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex w-20 items-center gap-1.5">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => updateProperty.mutate({ id: p.id, body: { active } })}
                  />
                  <span className="text-xs text-muted-foreground">active</span>
                </div>
                <div className="flex w-8 justify-center">
                  <ConfirmDelete
                    title={`Remove ${p.name}?`}
                    description="Its bookings, expenses and leads stay in the database but become unreachable. Reassign its users first."
                    onConfirm={() => deleteProperty.mutate(p.id)}
                    trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add property</DialogTitle></DialogHeader>
          <form onSubmit={onCreate} className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required autoFocus placeholder="e.g. Saratoga Farms" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input name="location" placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProperty.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
