export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HttpError";
  }
}

const statusCodeToErrorCode = (status: number): string => {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "payload_too_large";
  if (status >= 500) return "internal_server_error";
  return "http_error";
};

export const createHttpError = (
  status: number,
  message: string,
  code?: string
): HttpError => {
  return new HttpError(status, code ?? statusCodeToErrorCode(status), message);
};

export const isHttpError = (value: unknown): value is HttpError => {
  return value instanceof HttpError;
};
