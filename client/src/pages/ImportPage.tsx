import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, CheckCircle2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/lib/auth'

const TYPES = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'payments', label: 'Payments' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'visitors', label: 'Visitors' },
  { value: 'leads', label: 'Leads' },
]

const TEMPLATE_COLS: Record<string, string[]> = {
  bookings: ['Client', 'Phone', 'Check-in Date', 'Check-out Date', 'Check-in Time', 'Check-out Time', 'Pax', 'Purpose', 'Source', 'Venue', 'Catering', 'Decor', 'Music', 'Cleaning', 'License', 'Security', 'Notes'],
  payments: ['Client', 'Date', 'Amount', 'Method', 'Destination', 'Paid By', 'Notes'],
  expenses: ['Date', 'Category', 'Description', 'Amount', 'Vendor', 'Notes'],
  visitors: ['Date', 'Name', 'Phone', 'Purpose', 'In Time', 'Out Time', 'Remarks'],
  leads: ['Name', 'phone_number', 'email', 'state', 'Family_gathering_/party', 'Date', 'Remark 1', 'Assign'],
}

const TEMPLATE_ROWS: Record<string, string[][]> = {
  bookings: [
    ['Rahul Sharma', '9876543210', '2026-07-10', '2026-07-10', '15:00', '22:00', '25', 'Party', 'Direct', '20000', '15000', '5000', '3000', '2000', '0', '5000', 'Birthday party'],
    ['Priya Verma', '9812345678', '2026-07-12', '2026-07-13', '11:00', '10:00', '8', 'Shoot', 'Airbnb', '18000', '0', '0', '0', '0', '0', '0', 'Music video shoot'],
  ],
  payments: [
    ['Rahul Sharma', '2026-07-10', '10000', 'UPI', 'Rajound Paytm', 'Deepak', 'Advance'],
    ['Priya Verma', '2026-07-12', '18000', 'Cash', '', 'Akhil', 'Full payment'],
  ],
  expenses: [
    ['2026-07-01', 'Salary', 'July staff salary', '60000', '', ''],
    ['2026-07-03', 'Catering', 'Sharma party food', '12000', 'Anmol Caterers', ''],
  ],
  visitors: [
    ['2026-07-05', 'Rohit Gupta', '9811122233', 'Venue visit', '11:00', '12:00', 'Interested for August'],
    ['2026-07-06', 'Neha Singh', '9822233445', 'Enquiry', '16:30', '17:00', 'Asked for weekend rates'],
  ],
  leads: [
    ['Neha Singh', '9822233445', '', 'Delhi', 'Party', '2026-07-04', 'Asked for weekend rates', 'Deepak'],
    ['Aman Gupta', '9833344556', '', 'UP', 'Pre-wedding', '2026-07-05', 'Wants August dates', 'Simran'],
  ],
}

interface RunResult {
  total: number
  inserted: number
  updated: number
  skipped: number
  invalid: number
  errors: string[]
}

export default function ImportPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const types = isAdmin ? TYPES : TYPES.filter((t) => t.value === 'leads')
  const [type, setType] = useState(isAdmin ? 'bookings' : 'leads')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)

  const run = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('file', file!)
      return api<RunResult>('/import/run', { formData: fd })
    },
    onSuccess: (data) => {
      setResult(data)
      setFile(null)
      queryClient.invalidateQueries()
      toast.success(`Imported ${data.inserted} new record${data.inserted === 1 ? '' : 's'}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Import failed'),
  })

  return (
    <div>
      <PageHeader
        title="Import"
        description="Upload an Excel (.xlsx) or CSV file. Columns are auto-mapped and imported right away."
      />

      <Card>
        <CardContent className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Data type</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setResult(null) }}>
                <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="h-10 w-72 pt-2"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              />
            </div>
            <Button className="h-10" onClick={() => run.mutate()} disabled={!file || run.isPending}>
              <Upload className="size-5" /> {run.isPending ? 'Importing…' : 'Import'}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                const rows = [TEMPLATE_COLS[type], ...TEMPLATE_ROWS[type]]
                const blob = new Blob([rows.map((r) => r.join(',')).join('\n') + '\n'], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `${type}-sample.csv`
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              <Download className="size-5" /> Download sample file
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Exact duplicates (same guest, same date, same time) are skipped automatically. The same guest can still book different slots on the same day.
          </p>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6 border-success/25 bg-success/5">
          <CardContent className="px-6 py-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
              <CheckCircle2 className="size-5" /> Import complete
            </div>
            <div className="mt-2 text-[13px]">
              {result.total} rows processed: <b>{result.inserted}</b> added, <b>{result.updated}</b> updated,{' '}
              <b>{result.skipped}</b> duplicates skipped
              {result.invalid > 0 && <>, <b className="text-destructive">{result.invalid}</b> invalid</>}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-[12px] text-destructive">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
