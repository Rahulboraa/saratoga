import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Building2, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { ManagedUser, MigrationStatus, MigrationResult, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConfirmDelete from '@/components/ConfirmDelete'
import { propertyColor } from '@/lib/propertyLook'
import EmptyState from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

export default function Properties() {
  const queryClient = useQueryClient()
  // One dialog for both jobs: null while adding, the property being changed while editing.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<Property[]>('/properties'),
  })
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<ManagedUser[]>('/users'),
  })
  const { data: migration } = useQuery({
    queryKey: ['migration-status'],
    queryFn: () => api<MigrationStatus>('/maintenance/status'),
  })

  const runMigration = useMutation({
    mutationFn: () => api<MigrationResult>('/maintenance/migrate', { method: 'POST' }),
    onSuccess: (result) => {
      // Everything on screen was filtered by a property the old rows did not have.
      // Reset rather than clear, so the mounted queries refetch instead of sitting on
      // stale data until a reload.
      queryClient.resetQueries()
      const moved = Object.values(result.counts).reduce((sum, n) => sum + n, 0)
      toast.success(moved > 0 ? `${moved} records moved into ${result.property.name}` : 'Nothing left to migrate')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Migration failed'),
  })

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['properties'] })

  const createProperty = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/properties', { body }),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      toast.success('Project added')
    },
    onError,
  })

  const updateProperty = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/properties/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
    onError,
  })

  const saveEdits = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/properties/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      toast.success('Project updated')
    },
    onError,
  })

  const deleteProperty = useMutation({
    mutationFn: (id: string) => api(`/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Project removed')
    },
    onError,
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name'),
      legalName: fd.get('legalName'),
      location: fd.get('location'),
      address: fd.get('address'),
      gstin: fd.get('gstin'),
      invoicePrefix: fd.get('invoicePrefix') || 'INV',
      invoiceTerms: fd.get('invoiceTerms'),
      invoiceHeader: fd.get('invoiceHeader'),
      invoiceFooter: fd.get('invoiceFooter'),
      inclusions: fd.get('inclusions'),
      exclusions: fd.get('exclusions'),
      confirmationNotes: fd.get('confirmationNotes'),
      imageUrl: fd.get('imageUrl'),
      color: fd.get('color'),
    }
    if (editing) saveEdits.mutate({ id: editing.id, body })
    else createProperty.mutate(body)
  }

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(property: Property) {
    setEditing(property)
    setDialogOpen(true)
  }

  const staffCount = (id: string) => (users ?? []).filter((u) => u.propertyId === id).length

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Each project keeps its own bookings, expenses, leads and staff"
        actions={<Button onClick={openAdd}>Add property</Button>}
      />

      {!!migration?.total && (
        <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">{migration.total} records need migrating</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Records created before a change that has since landed — bookings and leads still on the old event
              type lists, or rows predating projects. Their old value is kept, and this can be run again safely.
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {Object.entries(migration.pending)
                .filter(([, n]) => n > 0)
                .map(([label, n]) => `${label}: ${n}`)
                .join(' · ')}
            </p>
          </div>
          <Button size="sm" onClick={() => runMigration.mutate()} disabled={runMigration.isPending}>
            {runMigration.isPending ? 'Migrating…' : 'Migrate now'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (properties ?? []).length === 0 ? (
        <EmptyState icon={Building2} message="No projects yet" description="Add one to start recording bookings against it." />
      ) : (
        <div className="divide-y rounded-xl border border-border/60 bg-card shadow-sm">
          {(properties ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: propertyColor(p) }}
                  >
                    <Building2 className="size-4 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{p.name}</span>
                    {!p.active && <Badge variant="destructive" withDot>inactive</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {p.location || 'No location set'} · {staffCount(p.id)} user{staffCount(p.id) === 1 ? '' : 's'}
                    {p.gstin && <> · GSTIN {p.gstin}</>}
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Edit"
                  className="text-muted-foreground"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="size-5" />
                </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : 'Add project'}</DialogTitle></DialogHeader>
          {/* Keyed on the property so the fields reload when switching between rows. */}
          <form key={editing?.id ?? 'new'} onSubmit={onSubmit} className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required autoFocus defaultValue={editing?.name ?? ''} placeholder="e.g. Saratoga Farms" />
            </div>
            <div className="space-y-1.5">
              <Label>Company name (on invoice)</Label>
              <Input
                name="legalName"
                defaultValue={editing?.legalName ?? ''}
                placeholder={editing?.name ? `Leave blank to use "${editing.name}"` : 'e.g. Saratõga INC'}
              />
              <p className="text-[11px] text-muted-foreground">
                The entity that raises the invoice, when that differs from what the villa is called.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input name="location" defaultValue={editing?.location ?? ''} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Photo URL</Label>
              <Input name="imageUrl" defaultValue={editing?.imageUrl ?? ''} placeholder="https://… (shown across the app)" />
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  name="color"
                  type="color"
                  defaultValue={propertyColor(editing)}
                  className="h-9 w-16 p-1"
                />
                <span className="text-[11px] text-muted-foreground">
                  Used on the banner and the switcher, so each property is told apart at a glance.
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Invoice address</Label>
              <Input name="address" defaultValue={editing?.address ?? ''} placeholder="Printed on sales invoices" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input name="gstin" defaultValue={editing?.gstin ?? ''} placeholder="Optional" autoCapitalize="characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice prefix</Label>
                <Input name="invoicePrefix" defaultValue={editing?.invoicePrefix ?? 'INV'} maxLength={10} />
              </div>
            </div>
            {editing && (
              <p className="text-[11px] text-muted-foreground">
                Changing the prefix only affects invoices issued from now on; ones already issued keep their number.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Invoice header</Label>
              <Textarea
                name="invoiceHeader"
                rows={2}
                defaultValue={editing?.invoiceHeader ?? ''}
                placeholder="Phone, email, CIN — anything extra under the address"
                className="text-[12px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice footer</Label>
              <Textarea
                name="invoiceFooter"
                rows={3}
                defaultValue={editing?.invoiceFooter ?? ''}
                placeholder="Bank details, signature line, thank-you note"
                className="text-[12px]"
              />
              <p className="text-[11px] text-muted-foreground">Printed at the very bottom, under the terms.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Invoice terms</Label>
              <Textarea
                name="invoiceTerms"
                rows={6}
                defaultValue={editing?.invoiceTerms ?? ''}
                placeholder="One term per line"
                className="text-[12px]"
              />
              <p className="text-[11px] text-muted-foreground">One per line — printed under the totals on every invoice.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmation inclusions</Label>
              <Textarea name="inclusions" rows={3} defaultValue={editing?.inclusions ?? ''} placeholder="One per line" className="text-[12px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmation exclusions</Label>
              <Textarea name="exclusions" rows={3} defaultValue={editing?.exclusions ?? ''} placeholder="One per line" className="text-[12px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmation notes</Label>
              <Textarea name="confirmationNotes" rows={3} defaultValue={editing?.confirmationNotes ?? ''} placeholder="One per line" className="text-[12px]" />
              <p className="text-[11px] text-muted-foreground">
                These three fill the WhatsApp confirmation sent from a booking. It stays editable before sending.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProperty.isPending || saveEdits.isPending}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
