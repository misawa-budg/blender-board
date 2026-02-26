import type { ErrorRequestHandler, RequestHandler } from "express";
import { createHttpError, isHttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(createHttpError(404, "Route not found."));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isHttpError(error)) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal Server Error" });
};
