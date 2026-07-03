import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Menu, LogOut, Home, CalendarDays, Users2, PhoneCall, Receipt,
  Coins, Upload, KeyRound, ChevronsUpDown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const NAV_MAIN = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/visitors', label: 'Visitors', icon: Users2 },
  { to: '/leads', label: 'CRM', icon: PhoneCall },
]

const NAV_ADMIN = [
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/incentives', label: 'Incentives', icon: Coins },
  { to: '/import', label: 'Import', icon: Upload },
  { to: '/users', label: 'Users', icon: KeyRound },
]

function NavItem({ to, label, icon: Icon, onNavigate }: { to: string; label: string; icon: typeof Home; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-all',
          isActive
            ? 'bg-[#eff6ff] font-bold text-[#2563eb] shadow-sm'
            : 'font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-[#2563eb]' : 'text-slate-400')} strokeWidth={isActive ? 2.5 : 2} />
          <span className="flex-1">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3">
      <div className="mb-2 px-2">
        <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-500">Main menu</p>
        {NAV_MAIN.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}
      </div>
      {user?.role === 'admin' && (
        <div className="px-2 pt-4">
          <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-500">Administration</p>
          {NAV_ADMIN.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}
        </div>
      )}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded bg-[#2563eb] text-[12px] font-bold text-white shadow-sm">
        SV
      </div>
      <span className="text-[18px] font-bold tracking-tight text-slate-900">Saratoga Villa</span>
    </div>
  )
}

function UserFooter() {
  const { user, logout } = useAuth()
  const initials = user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() ?? '?'
  return (
    <div className="border-t border-slate-200 bg-white p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[12px] font-medium text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-slate-900">{user?.name ?? '—'}</div>
              <div className="truncate text-[11px] capitalize leading-tight text-slate-500">{user?.role ?? ''}</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate text-[13px] font-medium">{user?.name ?? '—'}</div>
            <div className="truncate text-[11px] text-muted-foreground">@{user?.username}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-slate-200 bg-[#f8fafc] md:flex">
        <div className="px-5 pb-3 pt-5">
          <div className="mb-3"><Brand /></div>
        </div>
        <SidebarNav />
        <UserFooter />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/95 px-4 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="size-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col bg-[#f8fafc] p-0">
            <SheetTitle className="px-5 pb-1 pt-5 text-left"><Brand /></SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
            <UserFooter />
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      <main className="min-w-0 p-4 md:ml-[260px] md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
