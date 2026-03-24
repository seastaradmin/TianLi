const DEFAULT_API_BASE = '/api'

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function canParseAsUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function normalizeApiBase(rawValue?: string | null) {
  const value = rawValue?.trim()
  if (!value) {
    return DEFAULT_API_BASE
  }

  if (canParseAsUrl(value)) {
    const url = new URL(value)
    url.pathname = url.pathname === '/' ? DEFAULT_API_BASE : stripTrailingSlash(url.pathname)
    return stripTrailingSlash(url.toString())
  }

  if (value === '/') {
    return DEFAULT_API_BASE
  }

  return stripTrailingSlash(value)
}

export function resolveApiBase() {
  return normalizeApiBase(import.meta.env.VITE_API_BASE)
}

export function apiUrl(pathname: string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${resolveApiBase()}${normalizedPath}`
}
