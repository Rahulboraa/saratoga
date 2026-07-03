import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#0a0a0a_0%,#1a1208_100%)] p-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="text-4xl">🏡</div>
          <h1 className="mt-2 text-xl font-bold text-white">Saratoga Villa</h1>
          <p className="text-sm text-white/50">Booking Manager</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-white/70">Username</Label>
            <Input
              id="username"
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
              placeholder="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/70">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
              placeholder="••••••••"
            />
          </div>
          {(error || logoutMessage) && (
            <p className={`text-center text-sm ${error ? 'text-red-400' : 'text-amber-300/90'}`}>
              {error || logoutMessage}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full bg-[linear-gradient(135deg,#C9A84C,#F0D080)] font-bold text-[#1a1200] hover:opacity-90"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
