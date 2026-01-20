/**
 * Base custom error class with HTTP status code support
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  data?: object;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    data?: object
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || "ERROR";
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, data?: object) {
    super(400, message, "BAD_REQUEST", data);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message: string = "You are not authorized to perform this action",
    data?: object
  ) {
    super(401, message, "UNAUTHORIZED", data);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden", data?: object) {
    super(403, message, "FORBIDDEN", data);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(404, `${resource} not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, data?: object) {
    super(409, message, "CONFLICT", data);
    this.name = "ConflictError";
  }
}

export class GoneError extends AppError {
  constructor(message: string) {
    super(410, message, "GONE");
    this.name = "GoneError";
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, data?: object) {
    super(422, message, "UNPROCESSABLE_ENTITY", data);
    this.name = "UnprocessableEntityError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests, please try again later") {
    super(429, message, "TOO_MANY_REQUESTS");
    this.name = "TooManyRequestsError";
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(500, message, "INTERNAL_SERVER_ERROR");
    this.name = "InternalServerError";
  }
}
