import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHttpError } from "./httpError.js";

export type MediaKind = "images" | "models";

const uploadsRootPath = resolve(process.cwd(), process.env.BLENDER_BOARD_UPLOAD_ROOT ?? "uploads");
const uploadDirByKind: Record<MediaKind, string> = {
  images: join(uploadsRootPath, "images"),
  models: join(uploadsRootPath, "models"),
};

export const ensureUploadDirectories = (): void => {
  mkdirSync(uploadDirByKind.images, { recursive: true });
  mkdirSync(uploadDirByKind.models, { recursive: true });
};

export const getUploadDir = (kind: MediaKind): string => {
  return uploadDirByKind[kind];
};

export const resolveStoredFilePath = (kind: MediaKind, storedPath: string): string => {
  const basePath = uploadDirByKind[kind];
  const absolutePath = resolve(basePath, storedPath);
  const normalizedBasePath = `${basePath}${basePath.endsWith(sep) ? "" : sep}`;

  if (!absolutePath.startsWith(normalizedBasePath)) {
    throw createHttpError(400, "保存ファイルパスが不正です。");
  }

  return absolutePath;
};

export const deleteStoredFile = (
  kind: MediaKind,
  storedPath: string,
  options: { ignoreMissing?: boolean } = {}
): void => {
  let targetPath: string;
  try {
    targetPath = resolveStoredFilePath(kind, storedPath);
  } catch (error) {
    if (options.ignoreMissing) {
      return;
    }
    throw error;
  }

  if (!existsSync(targetPath)) {
    if (options.ignoreMissing) {
      return;
    }
    throw createHttpError(404, "保存ファイルが見つかりません。");
  }

  unlinkSync(targetPath);
};
