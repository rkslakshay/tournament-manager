import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import type { ApiErrorBody } from "@/lib/api-schemas";
import { ServiceError } from "../errors";

/** JSON response with the given status. */
export function json<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

/** Map any thrown value to the standard `{ error: { code, message, details } }` response. */
export function errorResponse(error: unknown): Response {
  if (error instanceof ServiceError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    const headers = error.code === "RATE_LIMITED" ? retryAfter(error.details) : undefined;
    return json(body, error.status, headers);
  }
  if (error instanceof ZodError) {
    return json<ApiErrorBody>(
      { error: { code: "VALIDATION", message: "Invalid request", details: error.flatten() } },
      400,
    );
  }
  console.error(error);
  return json<ApiErrorBody>({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
}

/** Read and validate a JSON body. Malformed JSON and schema failures become VALIDATION errors. */
export async function parseBody<Output, Input>(
  request: Request,
  schema: ZodType<Output, ZodTypeDef, Input>,
): Promise<Output> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError("VALIDATION", "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ServiceError("VALIDATION", "Invalid request", parsed.error.flatten());
  return parsed.data;
}

/** Run a handler and turn any thrown error into an error response. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return errorResponse(error);
  }
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function retryAfter(details: unknown): HeadersInit | undefined {
  const seconds = (details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  return seconds === undefined ? undefined : { "Retry-After": String(seconds) };
}
