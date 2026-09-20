import { Navigate, Route, Routes, Outlet } from 'react-router-dom'
import { useAuth } from './lib/auth'
import type { Role } from './types'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bookings from './pages/Bookings'
import Upcoming from './pages/Upcoming'
import Visitors from './pages/Visitors'
import Leads from './pages/Leads'
import Expenses from './pages/Expenses'
import Incentives from './pages/Incentives'
import Users from './pages/Users'
import Properties from './pages/Properties'
import Invoice from './pages/Invoice'
import Investments from './pages/Investments'
import Accounts from './pages/Accounts'
import ImportPage from './pages/ImportPage'
import Caretaker from './pages/Caretaker'

function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === 'caretaker' ? '/caretaker' : '/'} replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireRole roles={['caretaker']} />}>
        <Route path="/caretaker" element={<Caretaker />} />
      </Route>
      <Route element={<RequireRole roles={['admin', 'manager', 'sales']} />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/leads" element={<Leads />} />
          <Route element={<RequireRole roles={['admin', 'manager']} />}>
            <Route path="/import" element={<ImportPage />} />
            <Route path="/bookings/:id/invoice" element={<Invoice />} />
          </Route>
          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/incentives" element={<Incentives />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
