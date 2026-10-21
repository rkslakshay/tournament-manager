export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "DUPLICATE"
  | "CONFIRMATION_REQUIRED"
  | "EDIT_BLOCKED"
  | "VERSION_CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  DUPLICATE: 409,
  CONFIRMATION_REQUIRED: 409,
  EDIT_BLOCKED: 409,
  VERSION_CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** An expected failure with a stable code, mapped to `{ error: { code, message, details } }`. */
export class ServiceError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
    this.status = STATUS[code];
  }
}

export function notFound(what: string): ServiceError {
  return new ServiceError("NOT_FOUND", `${what} not found`);
}
