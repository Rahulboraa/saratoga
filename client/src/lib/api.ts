const TOKEN_KEY = 'sv_token'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface Options {
  method?: string
  body?: unknown
  formData?: FormData
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.formData ? 'POST' : 'GET'),
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  })

  const fresh = res.headers.get('x-refresh-token')
  if (fresh) setToken(fresh)

  const data = await res.json().catch(() => null)
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    onUnauthorized()
    throw new ApiError(401, 'Session expired', data)
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string })?.error ?? 'Request failed', data)
  }
  return data as T
}
