import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Home, CalendarDays, CalendarClock, PhoneCall, Users2, ClipboardList, IndianRupee } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'

interface Results {
  bookings: { id: string; guest: string; phone: string; checkinDate: string; purpose: string }[]
  leads: { id: string; name: string; phone: string; outcome: string }[]
  visitors: { id: string; name: string; phone: string; date: string }[]
}

export function openSearchPalette() {
  window.dispatchEvent(new CustomEvent('sv-search-open'))
}

export default function SearchPalette() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Results | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('sv-search-open', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('sv-search-open', onOpen)
    }
  }, [])

  useEffect(() => {
    if (!q.trim()) {
      setRes(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        setRes(await api<Results>(`/search?q=${encodeURIComponent(q)}`))
      } catch { /* ignore */ }
    }, 150)
    return () => clearTimeout(t)
  }, [q])

  if (!open) return null

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    navigate(href)
  }

  const empty = res && res.bookings.length === 0 && res.leads.length === 0 && res.visitors.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[530px] overflow-hidden rounded-[22px] border border-slate-200/60 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] duration-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookings, leads, visitors…"
            className="flex-1 bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-2 [scrollbar-width:none]">
          {!q && (
            <Section title="Navigation">
              <Row icon={Home} label="Dashboard" onClick={() => go('/')} />
              <Row icon={CalendarDays} label="Bookings" onClick={() => go('/bookings')} />
              <Row icon={CalendarClock} label="Upcoming" onClick={() => go('/upcoming')} />
              <Row icon={PhoneCall} label="CRM" onClick={() => go('/leads')} />
              {user?.role === 'admin' && <Row icon={IndianRupee} label="Expenses" onClick={() => go('/expenses')} />}
            </Section>
          )}

          {q && res && (
            <>
              {res.bookings.length > 0 && (
                <Section title="Bookings">
                  {res.bookings.map((b) => (
                    <Row key={b.id} icon={CalendarDays} label={b.guest} subLabel={`${fmtDate(b.checkinDate)} · ${b.purpose}${b.phone ? ` · ${b.phone}` : ''}`} onClick={() => go('/bookings')} />
                  ))}
                </Section>
              )}
              {res.leads.length > 0 && (
                <Section title="Leads">
                  {res.leads.map((l) => (
                    <Row key={l.id} icon={PhoneCall} label={l.name} subLabel={`${l.phone}${l.outcome ? ` · ${l.outcome}` : ''}`} onClick={() => go('/leads')} />
                  ))}
                </Section>
              )}
              {res.visitors.length > 0 && (
                <Section title="Visitors">
                  {res.visitors.map((v) => (
                    <Row key={v.id} icon={ClipboardList} label={v.name} subLabel={`${fmtDate(v.date)} · ${v.phone}`} onClick={() => go('/visitors')} />
                  ))}
                </Section>
              )}
              {empty && (
                <p className="px-4 py-9 text-center text-[13px] text-slate-400">No results for “{q}”.</p>
              )}
            </>
          )}
          {!q && (
            <div className="flex items-center gap-2 px-4 pb-2 pt-3 text-[11px] text-slate-400">
              <Users2 className="h-3.5 w-3.5" /> Type a guest, lead or visitor name / phone
            </div>
          )}
        </div>

        <div className="flex items-center border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] text-slate-400">
          <div className="mr-6 flex items-center gap-1.5">
            <kbd className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white font-sans text-[11px] font-bold text-slate-500 shadow-sm">↵</kbd>
            <span>to select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="flex h-5 w-8 items-center justify-center rounded border border-slate-200 bg-white font-sans text-[10px] font-bold text-slate-500 shadow-sm">ESC</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-1 py-1.5">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({ icon: Icon, label, subLabel, onClick }: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  subLabel?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-100"
    >
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50 transition-colors group-hover:bg-white">
        <Icon className="size-5 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-slate-900">{label}</div>
        {subLabel && <div className="mt-1 truncate text-[11px] leading-none text-slate-500">{subLabel}</div>}
      </div>
    </button>
  )
}
