import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ImportPreview, ImportResult } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const TYPES = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'payments', label: 'Payments' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'visitors', label: 'Visitors' },
  { value: 'leads', label: 'Leads' },
]

const PREVIEW_COLS: Record<string, string[]> = {
  bookings: ['guest', 'phone', 'checkinDate', 'checkoutDate', 'purpose'],
  payments: ['guest', 'date', 'amount', 'method'],
  expenses: ['date', 'cat', 'desc', 'amount', 'vendor'],
  visitors: ['date', 'name', 'phone', 'purpose'],
  leads: ['date', 'name', 'phone', 'eventType', 'exec'],
}

export default function ImportPage() {
  const queryClient = useQueryClient()
  const [type, setType] = useState('bookings')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<'skip' | 'update'>('skip')
  const [result, setResult] = useState<ImportResult | null>(null)

  const doPreview = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('file', file!)
      return api<ImportPreview>('/import/preview', { formData: fd })
    },
    onSuccess: (data) => {
      setPreview(data)
      setResult(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Preview failed'),
  })

  const doCommit = useMutation({
    mutationFn: () =>
      api<ImportResult>('/import/commit', {
        body: { type, mode, rows: preview!.rows.filter((r) => r.valid).map((r) => r.data) },
      }),
    onSuccess: (data) => {
      setResult(data)
      setPreview(null)
      setFile(null)
      queryClient.invalidateQueries()
      toast.success(`Imported: ${data.inserted} new, ${data.updated} updated, ${data.skipped} skipped`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Import failed'),
  })

  const cols = PREVIEW_COLS[type]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Import Data</h1>
        <p className="text-sm text-muted-foreground">Upload an Excel (.xlsx) or CSV file. Columns are auto-mapped — preview before committing.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="space-y-1.5">
            <Label>Data Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setPreview(null); setResult(null) }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>File</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="w-64"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null) }}
            />
          </div>
          <Button onClick={() => doPreview.mutate()} disabled={!file || doPreview.isPending}>
            {doPreview.isPending ? 'Parsing…' : 'Preview'}
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{preview.summary.total} rows</Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600">{preview.summary.valid} valid</Badge>
            {preview.summary.invalid > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-600">{preview.summary.invalid} invalid</Badge>
            )}
            {preview.summary.duplicates > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700">{preview.summary.duplicates} duplicates</Badge>
            )}
            {preview.mapping.unmapped.length > 0 && (
              <span className="text-xs text-muted-foreground">Ignored columns: {preview.mapping.unmapped.join(', ')}</span>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Preview</CardTitle>
              <div className="flex items-center gap-4">
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'skip' | 'update')} className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="skip" id="m-skip" />
                    <Label htmlFor="m-skip" className="text-sm font-normal">Skip duplicates</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="update" id="m-update" />
                    <Label htmlFor="m-update" className="text-sm font-normal">Update duplicates</Label>
                  </div>
                </RadioGroup>
                <Button
                  onClick={() => doCommit.mutate()}
                  disabled={preview.summary.valid === 0 || doCommit.isPending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {doCommit.isPending ? 'Importing…' : `✓ Import ${preview.summary.valid} rows`}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {cols.map((c) => <TableHead key={c} className="capitalize">{c}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 100).map((r) => (
                    <TableRow key={r.index} className={!r.valid ? 'bg-red-50/60' : undefined}>
                      <TableCell className="text-muted-foreground">{r.index + 1}</TableCell>
                      {cols.map((c) => (
                        <TableCell key={c} className="max-w-40 truncate">{String(r.data[c] ?? '')}</TableCell>
                      ))}
                      <TableCell>
                        {!r.valid ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help bg-red-50 text-red-600">invalid</Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">{r.errors.join('; ')}</TooltipContent>
                          </Tooltip>
                        ) : r.duplicate ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">duplicate</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600">new</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rows.length > 100 && (
                <p className="mt-2 text-xs text-muted-foreground">Showing first 100 of {preview.rows.length} rows.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="px-5 py-4 text-sm">
            ✅ Import complete — <b>{result.inserted}</b> inserted, <b>{result.updated}</b> updated,{' '}
            <b>{result.skipped}</b> skipped{result.invalid > 0 && <>, <b className="text-red-600">{result.invalid}</b> invalid</>}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
