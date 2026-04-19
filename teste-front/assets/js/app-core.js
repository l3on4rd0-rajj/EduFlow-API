(() => {
  const STORAGE_KEYS = {
    apiBaseUrl: 'rajj.apiBaseUrl',
    token: 'token',
    user: 'user',
  }

  const getMetaContent = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.content?.trim() || ''

  const trimTrailingSlash = (value) => value.replace(/\/+$/, '')
  const DEFAULT_API_PORT = '3000'

  const getConfiguredApiBaseUrl = () => {
    const fromMeta = getMetaContent('api-base-url')
    const fromStorage = window.localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || ''
    const fromWindow = window.__RAJJ_CONFIG__?.apiBaseUrl || ''
    const configured = fromMeta || fromWindow || fromStorage

    if (configured) {
      return trimTrailingSlash(configured)
    }

    const { protocol, hostname, port } = window.location

    if (port && port !== DEFAULT_API_PORT) {
      return `${protocol}//${hostname}:${DEFAULT_API_PORT}`
    }

    return ''
  }

  const API_BASE_URL = getConfiguredApiBaseUrl()

  const buildUrl = (path) => {
    if (!path) return API_BASE_URL || window.location.origin
    if (/^https?:\/\//i.test(path)) return path

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (!API_BASE_URL) return normalizedPath

    return `${API_BASE_URL}${normalizedPath}`
  }

  const parseBody = async (response) => {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return response.json()
    }

    const text = await response.text()
    return text ? { message: text } : null
  }

  const apiFetch = async (path, options = {}) => {
    const {
      auth = false,
      body,
      headers = {},
      method = 'GET',
      ...rest
    } = options

    const normalizedHeaders = new Headers(headers)
    if (!normalizedHeaders.has('Accept')) {
      normalizedHeaders.set('Accept', 'application/json')
    }

    if (auth) {
      const token = window.localStorage.getItem(STORAGE_KEYS.token)
      if (token) {
        normalizedHeaders.set('Authorization', `Bearer ${token}`)
      }
    }

    const finalOptions = {
      method,
      headers: normalizedHeaders,
      ...rest,
    }

    if (body !== undefined) {
      if (body instanceof FormData) {
        finalOptions.body = body
      } else {
        if (!normalizedHeaders.has('Content-Type')) {
          normalizedHeaders.set('Content-Type', 'application/json')
        }
        finalOptions.body = JSON.stringify(body)
      }
    }

    const response = await fetch(buildUrl(path), finalOptions)
    const payload = await parseBody(response)

    if (!response.ok) {
      const error = new Error(
        payload?.message || payload?.error || `Erro na requisicao (${response.status})`
      )
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  }

  const requireAuth = (redirectPath = 'login.html') => {
    const token = window.localStorage.getItem(STORAGE_KEYS.token)
    if (!token) {
      window.location.href = redirectPath
      return null
    }
    return token
  }

  const fileUrl = (path) => {
    if (!path) return null
    if (/^https?:\/\//i.test(path)) return path
    return buildUrl(path)
  }

  const signOut = (redirectPath = 'login.html') => {
    window.localStorage.removeItem(STORAGE_KEYS.token)
    window.localStorage.removeItem(STORAGE_KEYS.user)
    window.location.href = redirectPath
  }

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }
      return entities[char] || char
    })

  window.RAJJ = {
    apiBaseUrl: API_BASE_URL,
    apiFetch,
    buildUrl,
    escapeHtml,
    fileUrl,
    requireAuth,
    signOut,
    storageKeys: STORAGE_KEYS,
  }
})()
