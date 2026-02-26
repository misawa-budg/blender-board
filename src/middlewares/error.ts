import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { createHttpError, isHttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(createHttpError(404, "ルートが見つかりません。", "route_not_found"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isHttpError(error)) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }

  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "アップロードファイルのサイズが大きすぎます。",
        code: "payload_too_large",
      });
    }
    return res.status(400).json({ error: error.message, code: "upload_error" });
  }

  console.error(error);
  return res.status(500).json({
    error: "サーバー内部エラーが発生しました。",
    code: "internal_server_error",
  });
};
