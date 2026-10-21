import type { ApiErrorBody } from "./api-schemas";

/** An error response from the API, with its stable code and optional details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Call the JSON API. Sends the admin token as a bearer token when given, and throws an
 * `ApiError` for non-2xx responses.
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL",
      error?.message ?? "Request failed",
      error?.details,
    );
  }
  return data as T;
}
