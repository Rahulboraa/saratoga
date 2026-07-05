import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Menu, LogOut, Home, CalendarDays, Users2, PhoneCall,
  Upload, KeyRound, ChevronsUpDown, ChevronRight, CalendarClock, IndianRupee, Trophy,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import InstallButton from '@/components/InstallPrompt'
import ThemeToggle from '@/components/ThemeToggle'
import SearchPalette, { openSearchPalette } from '@/components/SearchPalette'
import { Search } from 'lucide-react'

const NAV_MAIN = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarClock },
  { to: '/visitors', label: 'Visitors', icon: Users2 },
  { to: '/leads', label: 'CRM', icon: PhoneCall },
]

const NAV_ADMIN = [
  { to: '/expenses', label: 'Expenses', icon: IndianRupee },
  { to: '/incentives', label: 'Incentives', icon: Trophy },
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
            ? 'bg-[#eff6ff] font-bold text-[#2563eb] dark:bg-primary/15 dark:text-primary'
            : 'font-medium text-foreground/75 hover:bg-accent hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-5 shrink-0', isActive ? 'text-[#2563eb] dark:text-primary' : 'text-muted-foreground/70')} strokeWidth={isActive ? 2.5 : 2} />
          <span className="flex-1">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
      <div className="mb-2 px-2">
        <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Main menu</p>
        {NAV_MAIN.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}
      </div>
      {user?.role === 'admin' && (
        <div className="px-2 pt-4">
          <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Administration</p>
          {NAV_ADMIN.map((n) => <NavItem key={n.to} {...n} onNavigate={onNavigate} />)}
        </div>
      )}
    </nav>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">Saratoga Villa</span>
    </span>
  )
}

function UserFooter() {
  const { user, logout } = useAuth()
  const initials = user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() ?? '?'
  return (
    <div className="border-t border-border bg-background p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-medium text-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{user?.name ?? '—'}</div>
              <div className="truncate text-[11px] capitalize leading-tight text-muted-foreground">{user?.role ?? ''}</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate text-[13px] font-medium">{user?.name ?? '—'}</div>
            <div className="truncate text-[11px] text-muted-foreground">@{user?.username}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
            <LogOut className="mr-2 size-5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const PAGE_LABELS: Record<string, string> = {
  '': 'Dashboard', bookings: 'Bookings', upcoming: 'Upcoming', visitors: 'Visitors', leads: 'CRM',
  expenses: 'Expenses', incentives: 'Incentives', import: 'Import', users: 'Users',
}

function TopBar() {
  const { pathname } = useLocation()
  const key = pathname.split('/').filter(Boolean)[0] ?? ''
  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center gap-2 border-b border-border/60 bg-background px-6 md:flex">
      <nav className="flex items-center gap-2 text-[13px]">
        <NavLink to="/" className="text-muted-foreground transition-colors hover:text-foreground">Saratoga Villa</NavLink>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="font-medium text-foreground">{PAGE_LABELS[key] ?? 'Dashboard'}</span>
      </nav>
      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={openSearchPalette}
          className="relative inline-flex h-9 w-full max-w-[300px] items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span>Search…</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>
    </div>
  )
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { user } = useAuth()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className={cn('grid', 'grid-cols-5')}>
        {(user?.role === 'admin' ? NAV_MAIN.slice(0, 4) : NAV_MAIN).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive ? 'text-[#2563eb] dark:text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={onMore}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" />
            More
          </button>
        )}
      </div>
    </nav>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-border bg-[#f8fafc] dark:bg-sidebar md:flex">
        <div className="px-5 pb-3 pt-5">
          <div className="mb-6"><Brand /></div>
        </div>
        <SidebarNav />
        <UserFooter />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="size-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[280px] flex-col bg-[#f8fafc] p-0 dark:bg-sidebar">
            <SheetTitle className="px-5 pb-1 pt-5 text-left"><Brand /></SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
            <UserFooter />
          </SheetContent>
        </Sheet>
        <Brand />
        <div className="ml-auto flex items-center gap-1"><ThemeToggle /><InstallButton /></div>
      </header>

      <main className="min-h-screen bg-slate-50/50 dark:bg-background md:pl-[260px]">
        <TopBar />
        <div className="animate-fade-in mx-auto px-4 py-5 pb-24 sm:px-5 sm:py-6 md:px-6 md:py-6 md:pb-6">
          <Outlet />
        </div>
      </main>

      <BottomNav onMore={() => setOpen(true)} />
      <SearchPalette />
    </div>
  )
}
