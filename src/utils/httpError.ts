export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export const createHttpError = (status: number, message: string): HttpError => {
  return new HttpError(status, message);
};

export const isHttpError = (value: unknown): value is HttpError => {
  return value instanceof HttpError;
};
