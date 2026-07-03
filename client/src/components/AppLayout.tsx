import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/bookings', label: 'Bookings', icon: '📅' },
  { to: '/visitors', label: 'Visitors', icon: '👥' },
  { to: '/leads', label: 'CRM', icon: '📞' },
  { to: '/expenses', label: 'Expenses', icon: '🧾', admin: true },
  { to: '/incentives', label: 'Incentives', icon: '💰', admin: true },
  { to: '/import', label: 'Import', icon: '⬆️', admin: true },
  { to: '/users', label: 'Users', icon: '🔑', admin: true },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/20 text-primary border-primary/40',
  manager: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  sales: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => !n.admin || user?.role === 'admin').map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
          }
        >
          <span>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  const userBox = (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
      <Badge variant="outline" className={cn('uppercase', ROLE_COLORS[user?.role ?? ''])}>{user?.role}</Badge>
      <Button variant="ghost" size="icon" onClick={() => logout()} title="Log out">
        <LogOut className="size-4" />
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 px-1">
          <div className="text-lg font-bold">🏡 Saratoga Villa</div>
          <div className="text-xs text-muted-foreground">Booking Manager</div>
        </div>
        <NavItems />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="size-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <SheetTitle className="mb-4 text-left text-base">🏡 Saratoga Villa</SheetTitle>
                <NavItems onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-bold">🏡 Saratoga Villa</span>
          </div>
          <div className="hidden md:block" />
          {userBox}
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
