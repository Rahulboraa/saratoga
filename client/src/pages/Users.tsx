import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ManagedUser, Role } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import ConfirmDelete from '@/components/ConfirmDelete'
import { PageHeader } from '@/components/PageHeader'

const ROLES: Role[] = ['admin', 'manager', 'sales', 'caretaker']

export default function Users() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [resetFor, setResetFor] = useState<ManagedUser | null>(null)
  const [newRole, setNewRole] = useState<Role>('sales')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<ManagedUser[]>('/users'),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['execs'] })
  }

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')

  const createUser = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/users', { body }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      toast.success('User created')
    },
    onError,
  })

  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidate(),
    onError,
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api(`/users/${id}/password`, { body: { password } }),
    onSuccess: () => {
      setResetFor(null)
      toast.success('Password updated')
    },
    onError,
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('User removed')
    },
    onError,
  })

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createUser.mutate({
      username: fd.get('username'), password: fd.get('password'), name: fd.get('name'), role: newRole,
    })
  }

  function onReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    resetPassword.mutate({ id: resetFor!.id, password: String(fd.get('password')) })
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Team access, roles and passwords"
        actions={<Button onClick={() => setAddOpen(true)}>+ Add user</Button>}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="divide-y rounded-xl border border-border/60 bg-card shadow-sm">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                  {u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{u.name}</span>
                    {u.id === me?.id && <Badge variant="info">you</Badge>}
                    {!u.active && <Badge variant="destructive" withDot>inactive</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">@{u.username}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Select
                  value={u.role}
                  onValueChange={(role) => updateUser.mutate({ id: u.id, body: { role } })}
                  disabled={u.id === me?.id}
                >
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex w-20 items-center gap-1.5">
                  <Switch
                    checked={u.active}
                    disabled={u.id === me?.id}
                    onCheckedChange={(active) => updateUser.mutate({ id: u.id, body: { active } })}
                  />
                  <span className="text-xs text-muted-foreground">active</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setResetFor(u)}>
                  <KeyRound className="size-3.5" /> Reset
                </Button>
                <div className="flex w-8 justify-center">
                  {u.id !== me?.id ? (
                    <ConfirmDelete
                      title={`Remove user ${u.name}?`}
                      onConfirm={() => deleteUser.mutate(u.id)}
                      trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button>}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input name="username" required autoCapitalize="none" pattern="[A-Za-z0-9_.\-]{2,30}" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input name="password" type="password" required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUser.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset password — {resetFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={onReset} className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input name="password" type="password" required minLength={6} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>Cancel</Button>
              <Button type="submit" disabled={resetPassword.isPending}>Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
