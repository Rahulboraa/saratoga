import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { nowHm } from '@/lib/format'
import { FU_STATUSES, type Visitor } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TimeSelect } from '@/components/DatePicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FormValues {
  name: string
  phone: string
  purpose: string
  inTime: string
  outTime: string
  remarks: string
  fuStatus: string
  fuRemark: string
}

function toForm(v?: Visitor | null): FormValues {
  return {
    name: v?.name ?? '',
    phone: v?.phone ?? '',
    purpose: v?.purpose ?? '',
    inTime: v?.inTime ?? nowHm(),
    outTime: v?.outTime ?? '',
    remarks: v?.remarks ?? '',
    fuStatus: v?.fuStatus || 'none',
    fuRemark: v?.fuRemark ?? '',
  }
}

export default function VisitorSheet({ open, onClose, visitor }: { open: boolean; onClose: () => void; visitor?: Visitor | null }) {
  const { user } = useAuth()
  const isCaretaker = user?.role === 'caretaker'
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: toForm(visitor),
  })

  useEffect(() => {
    if (open) reset(toForm(visitor))
  }, [open, visitor, reset])

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      visitor
        ? api<Visitor>(`/visitors/${visitor.id}`, { method: 'PATCH', body })
        : api<Visitor>('/visitors', { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
      toast.success(visitor ? 'Entry updated' : 'Visitor logged')
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  const onSubmit = handleSubmit((v) => {
    const body: Record<string, unknown> = {
      name: v.name, phone: v.phone, purpose: v.purpose,
      inTime: v.inTime, outTime: v.outTime, remarks: v.remarks,
    }
    if (!isCaretaker) {
      body.fuStatus = v.fuStatus === 'none' ? '' : v.fuStatus
      body.fuRemark = v.fuRemark
    }
    save.mutate(body)
  })

  const fuStatus = watch('fuStatus')

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{visitor ? 'Edit entry' : 'Log visitor'}</SheetTitle>
          <SheetDescription>{visitor ? `Editing ${visitor.name}` : "Record a visitor's arrival"}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Visitor Name *</Label>
              <Input {...register('name', { required: true })} aria-invalid={!!errors.name} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number *</Label>
              <Input {...register('phone', { required: true })} inputMode="tel" aria-invalid={!!errors.phone} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Purpose of Visit</Label>
              <Input {...register('purpose')} placeholder="Delivery, Meeting, Event…" />
            </div>
            <div className="space-y-2">
              <Label>In time</Label>
              <TimeSelect value={watch('inTime')} onChange={(v) => setValue('inTime', v)} allowEmpty />
            </div>
            <div className="space-y-2">
              <Label>Out time</Label>
              <TimeSelect value={watch('outTime')} onChange={(v) => setValue('outTime', v)} allowEmpty />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea rows={2} {...register('remarks')} />
          </div>
          {!isCaretaker && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-accent/30 p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Follow-up Status</Label>
                <Select value={fuStatus} onValueChange={(v) => setValue('fuStatus', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {FU_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Follow-up Remark</Label>
                <Input {...register('fuRemark')} placeholder="Sales team note" />
              </div>
            </div>
          )}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save entry</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
