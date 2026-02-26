import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { createHttpError, isHttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(createHttpError(404, "Route not found."));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isHttpError(error)) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Uploaded file is too large." });
    }
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal Server Error" });
};
