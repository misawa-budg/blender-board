import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Request } from "express";
import multer from "multer";
import { createHttpError } from "../utils/httpError.js";
import { ensureUploadDirectories, getUploadDir, type MediaKind } from "../utils/storage.js";

type UploadRule = {
  kind: MediaKind;
  allowedExtensions: string[];
  maxFileSize: number;
};

const imageUploadRule: UploadRule = {
  kind: "images",
  allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  maxFileSize: 10 * 1024 * 1024,
};

const modelUploadRule: UploadRule = {
  kind: "models",
  allowedExtensions: [".obj", ".fbx", ".blend", ".glb", ".gltf", ".stl", ".ply"],
  maxFileSize: 200 * 1024 * 1024,
};

const modelPreviewUploadRule: UploadRule = {
  kind: "models",
  allowedExtensions: [".glb", ".gltf"],
  maxFileSize: 200 * 1024 * 1024,
};

const modelThumbnailUploadRule: UploadRule = {
  kind: "models",
  allowedExtensions: imageUploadRule.allowedExtensions,
  maxFileSize: imageUploadRule.maxFileSize,
};

const createUploader = (rule: UploadRule) => {
  ensureUploadDirectories();

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, getUploadDir(rule.kind));
      },
      filename: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      if (!rule.allowedExtensions.includes(extension)) {
        callback(
          createHttpError(
            400,
            `未対応の拡張子です: ${extension || "(拡張子なし)"}`
          )
        );
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: rule.maxFileSize,
      files: 1,
    },
  });
};

const createUploadMiddleware = (rule: UploadRule) => {
  return createUploader(rule).single("file");
};

const modelFileFilter = (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const extension = extname(file.originalname).toLowerCase();
  if (file.fieldname === "file") {
    if (modelUploadRule.allowedExtensions.includes(extension)) {
      callback(null, true);
      return;
    }
    callback(
      createHttpError(400, `未対応の拡張子です: ${extension || "(拡張子なし)"}`)
    );
    return;
  }

  if (file.fieldname === "previewFile") {
    if (modelPreviewUploadRule.allowedExtensions.includes(extension)) {
      callback(null, true);
      return;
    }
    callback(
      createHttpError(
        400,
        `previewFileはglb/gltfのみ対応です: ${extension || "(拡張子なし)"}`
      )
    );
    return;
  }

  if (file.fieldname === "thumbnailFile") {
    if (modelThumbnailUploadRule.allowedExtensions.includes(extension)) {
      callback(null, true);
      return;
    }
    callback(
      createHttpError(
        400,
        `thumbnailFileは画像形式のみ対応です: ${extension || "(拡張子なし)"}`
      )
    );
    return;
  }

  callback(createHttpError(400, `未対応のアップロード項目です: ${file.fieldname}`));
};

export const uploadImageFile = createUploadMiddleware(imageUploadRule);
export const uploadModelFiles = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, getUploadDir(modelUploadRule.kind));
    },
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  fileFilter: modelFileFilter,
  limits: {
    fileSize: modelUploadRule.maxFileSize,
    files: 3,
  },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "previewFile", maxCount: 1 },
  { name: "thumbnailFile", maxCount: 1 },
]);
