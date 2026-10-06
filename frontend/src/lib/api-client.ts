import { useAuthStore } from "@/store/auth-store"
import type { TokenPair } from "@/lib/types"

// FastAPI's default validation-error handler returns `detail` as an array of
// {loc, msg, type} objects (not a string) for 422s that a Pydantic schema
// rejects before ever reaching a hand-written HTTPException. Every call site
// in the app does `error instanceof ApiError ? error.detail : fallback` and
// renders the result directly in a toast, so `detail` must always end up as
// a readable string here — otherwise the toast shows "[object Object]".
function extractDetail(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw) return raw
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join(", ")
  }
  return fallback
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1"

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

// A hard navigation (not router.push) is intentional: this module sits
// outside React and a full reload guarantees a clean app/query cache state
// after an unrecoverable session/tenant-access change. Returns a promise
// that never settles, rather than throwing, because the caller's page is
// about to unload anyway — throwing here would still let every other
// in-flight request (a single dashboard mount fires several in parallel)
// reach its own onError and pop its own toast in the moment before
// navigation actually completes, i.e. a toast storm right as the screen
// redirects.
function redirectAndAbandon<T>(to: string, fallbackMessage: string): Promise<T> {
  if (typeof window === "undefined") {
    // No navigation possible outside the browser (this module's queries
    // only ever run client-side in practice) — fail fast instead of
    // hanging a server-side call forever.
    return Promise.reject(new ApiError(401, fallbackMessage))
  }
  window.location.href = to
  return new Promise<T>(() => {})
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    useAuthStore.getState().clear()
    return null
  }

  const tokens = (await response.json()) as TokenPair
  useAuthStore.getState().setTokens(tokens)
  return tokens.access_token
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  skipAuth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options

  const doFetch = async (accessToken: string | null): Promise<Response> => {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string> | undefined),
    }
    if (accessToken && !skipAuth) {
      requestHeaders["Authorization"] = `Bearer ${accessToken}`
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let accessToken = useAuthStore.getState().accessToken
  let response = await doFetch(accessToken)

  if (response.status === 401 && !skipAuth && useAuthStore.getState().refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    accessToken = await refreshPromise

    if (accessToken) {
      response = await doFetch(accessToken)
    } else {
      return redirectAndAbandon<T>("/login", "Session expired")
    }
  } else if (response.status === 401 && !skipAuth && useAuthStore.getState().impersonation) {
    // "View as" sessions are access-token-only (no refresh) so they expire
    // on their own — land the superadmin back on their real session instead
    // of leaving every request 401ing silently.
    useAuthStore.getState().stopImpersonation()
    return redirectAndAbandon<T>("/superadmin", "Impersonation session expired")
  } else if (response.status === 403 && !skipAuth && response.headers.get("X-Gym-Blocked") === "true") {
    // The gym this account belongs to got suspended (auto, after its trial
    // ran out with no paid plan, or by a superadmin) — every endpoint now
    // 403s with this same header, so without this every simultaneous query
    // on the current screen would independently toast the same "gimnasio
    // suspendido" message. Force a clean logout instead, same shape as the
    // two cases above.
    useAuthStore.getState().clear()
    return redirectAndAbandon<T>("/login", "Gym suspended")
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { detail?: unknown }
      detail = extractDetail(body.detail, detail)
    } catch {
      // response had no JSON body
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
}
