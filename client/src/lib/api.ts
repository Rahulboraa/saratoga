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

/**
 * Session storage pins a signed-in user to the tab that signed them in; local storage
 * carries it over to a new tab or a relaunched PWA. Without the tab-level copy, signing
 * in as someone else anywhere in the browser silently reassigns every other open tab —
 * an admin reloads and comes back as whoever logged in last.
 */
function readStored(key: string) {
  try {
    const pinned = sessionStorage.getItem(key)
    if (pinned !== null) return pinned
    const shared = localStorage.getItem(key)
    // Pin it, so this tab keeps the identity it started with.
    if (shared !== null) sessionStorage.setItem(key, shared)
    return shared
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, value)
      localStorage.setItem(key, value)
    }
  } catch {
    // Private-mode browsers keep the session in memory for this page only.
  }
}

export function getToken() {
  return readStored(TOKEN_KEY)
}

export function setToken(token: string | null) {
  writeStored(TOKEN_KEY, token)
}

/**
 * The property the user is looking at. Lives here so both `api` and `apiDownload`
 * stamp it on every request without each caller remembering to.
 */
export function getActiveProperty() {
  return readStored(PROPERTY_KEY) || ''
}

export function setActiveProperty(id: string | null) {
  writeStored(PROPERTY_KEY, id)
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
