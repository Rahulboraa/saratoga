import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import loginBg from '@/assets/login-bg.jpg'

export default function Login() {
  const { login, logoutMessage } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(username, password)
      navigate(user.role === 'caretaker' ? '/caretaker' : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden items-end overflow-hidden bg-slate-950 lg:flex lg:w-[60%]">
        <img src={loginBg} alt="Saratoga Villa at dusk" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="relative z-10 p-12">
          <h2 className="text-4xl font-bold tracking-tight text-white">Saratoga Villa</h2>
          <p className="mt-2 text-lg text-white/80">Bookings, payments, visitors and CRM in one place.</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 sm:p-12 lg:w-[40%]">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col gap-2">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground shadow-md lg:hidden">
              SV
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to Saratoga Villa Booking Manager</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                placeholder="username"
                className="h-11"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {(error || logoutMessage) && (
              <p className={`text-sm ${error ? 'text-red-600' : 'text-amber-700'}`}>{error || logoutMessage}</p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={busy || !username || !password}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
