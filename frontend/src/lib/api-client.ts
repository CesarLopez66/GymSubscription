import { useAuthStore } from "@/store/auth-store"
import type { ApiErrorBody, TokenPair } from "@/lib/types"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

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
      if (typeof window !== "undefined") {
        // A hard navigation (not router.push) is intentional: this module
        // sits outside React and a full reload guarantees a clean app/query
        // cache state after an unrecoverable session expiry.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login"
      }
      throw new ApiError(401, "Session expired")
    }
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as ApiErrorBody
      if (body.detail) detail = body.detail
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
