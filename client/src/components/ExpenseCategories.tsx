import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { ExpenseCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConfirmDelete from '@/components/ConfirmDelete'

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api<ExpenseCategory[]>('/expense-categories'),
    staleTime: 5 * 60_000,
  })
}

export default function ExpenseCategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useExpenseCategories()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    // A rename rewrites the category on existing expenses, so those lists are stale too.
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const add = useMutation({
    mutationFn: (name: string) => api('/expense-categories', { body: { name } }),
    onSuccess: () => { invalidate(); setDraft(''); toast.success('Category added') },
    onError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/expense-categories/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { invalidate(); setEditingId(null) },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/expense-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('Category removed') },
    onError,
  })

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = draft.trim()
    if (name) add.mutate(name)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Expense categories</DialogTitle></DialogHeader>

        <form onSubmit={onAdd} className="mt-1 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New category"
            maxLength={40}
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || add.isPending}>Add</Button>
        </form>

        <div className="mt-1 max-h-80 divide-y overflow-y-auto rounded-lg border border-border/60">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2">
              {editingId === c.id ? (
                <>
                  <Input
                    defaultValue={c.name}
                    autoFocus
                    maxLength={40}
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') update.mutate({ id: c.id, body: { name: e.currentTarget.value.trim() } })
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    id={`cat-${c.id}`}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Save"
                    onClick={() => {
                      const el = document.getElementById(`cat-${c.id}`) as HTMLInputElement | null
                      if (el?.value.trim()) update.mutate({ id: c.id, body: { name: el.value.trim() } })
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="Cancel" onClick={() => setEditingId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[13px] ${c.active ? 'font-medium' : 'text-muted-foreground line-through'}`}>
                      {c.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.inUse > 0 ? `${c.inUse} expense${c.inUse === 1 ? '' : 's'}` : 'not used yet'}
                    </div>
                  </div>
                  <Switch
                    checked={c.active}
                    title={c.active ? 'Hide from new expenses' : 'Show again'}
                    onCheckedChange={(active) => update.mutate({ id: c.id, body: { active } })}
                  />
                  <Button size="icon-sm" variant="ghost" title="Rename" onClick={() => setEditingId(c.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDelete
                    title={`Remove ${c.name}?`}
                    onConfirm={() => remove.mutate(c.id)}
                    trigger={
                      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" title="Remove">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Renaming updates every expense already filed under it. A category in use cannot be removed —
          switch it off instead to keep the history but hide it from new entries.
        </p>
      </DialogContent>
    </Dialog>
  )
}
