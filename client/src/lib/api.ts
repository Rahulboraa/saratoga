const TOKEN_KEY = 'sv_token'
const PROPERTY_KEY = 'sv_property'

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

/**
 * The property the user is looking at. Lives here so both `api` and `apiDownload`
 * stamp it on every request without each caller remembering to.
 */
export function getActiveProperty() {
  try {
    return localStorage.getItem(PROPERTY_KEY) || ''
  } catch {
    return ''
  }
}

export function setActiveProperty(id: string | null) {
  try {
    if (id) localStorage.setItem(PROPERTY_KEY, id)
    else localStorage.removeItem(PROPERTY_KEY)
  } catch {
    // Private-mode browsers fall back to the all-properties view.
  }
}

function propertyHeader(): Record<string, string> {
  const id = getActiveProperty()
  return id ? { 'x-property': id } : {}
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
  const headers: Record<string, string> = { ...propertyHeader() }
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

export async function apiDownload(path: string, filename: string) {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    headers: { ...propertyHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new ApiError(res.status, 'Download failed', null)
  const fresh = res.headers.get('x-refresh-token')
  if (fresh) setToken(fresh)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
