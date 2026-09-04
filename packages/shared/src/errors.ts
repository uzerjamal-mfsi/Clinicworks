export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly correlationId: string | undefined;

  constructor(message: string, statusCode: number, code: string, correlationId?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = correlationId;
  }
}

export function badRequest(message: string, correlationId?: string) {
  return new AppError(message, 400, "BAD_REQUEST", correlationId);
}

export function notFound(message: string, correlationId?: string) {
  return new AppError(message, 404, "NOT_FOUND", correlationId);
}

export function internalError(message: string, correlationId?: string) {
  return new AppError(message, 500, "INTERNAL_ERROR", correlationId);
}

export function toErrorResponse(error: unknown, correlationId?: string) {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        correlationId: error.correlationId ?? correlationId,
      },
    };
  }
  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        correlationId,
      },
    };
  }
  return {
    status: 500,
    body: {
      error: "Unknown error",
      code: "INTERNAL_ERROR",
      correlationId,
    },
  };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
