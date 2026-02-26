import { randomUUID } from "node:crypto";
import { extname } from "node:path";
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

const createUploadMiddleware = (rule: UploadRule) => {
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
        callback(createHttpError(400, `Unsupported file extension: ${extension || "(none)"}`));
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: rule.maxFileSize,
      files: 1,
    },
  }).single("file");
};

export const uploadImageFile = createUploadMiddleware(imageUploadRule);
export const uploadModelFile = createUploadMiddleware(modelUploadRule);
