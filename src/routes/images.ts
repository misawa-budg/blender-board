import { existsSync, unlinkSync } from "node:fs";
import { Router } from "express";
import {
  createImage,
  deleteImageWithHook,
  findImageById,
  listImages,
  updateImage,
  updateImageWithHook,
} from "../features/images/service.js";
import { uploadImageFile } from "../middlewares/upload.js";
import {
  parsePositiveInt,
  validateCreateMediaInput,
  validateListQuery,
  validateUpdateMediaInput,
} from "../utils/validators.js";
import { createHttpError } from "../utils/httpError.js";
import { deleteStoredFile, resolveStoredFilePath } from "../utils/storage.js";
import { hasValidFileSignature } from "../utils/fileSignature.js";
import type { Image } from "../types/entities.js";

const router = Router();

type ImageListItemResponse = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
};

const toImageListItemResponse = (image: Image): ImageListItemResponse => {
  return {
    id: image.id,
    title: image.title,
    author: image.author,
    createdAt: image.createdAt,
    originalName: image.originalName,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    downloadUrl: `/api/images/${image.id}/download`,
  };
};

const ensureValidUploadedImageFile = (filePath: string, originalName: string): void => {
  if (hasValidFileSignature("images", filePath, originalName)) {
    return;
  }

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
  throw createHttpError(
    400,
    "ファイル内容が拡張子・形式と一致しません。",
    "invalid_file_signature"
  );
};

router.get("/", (req, res) => {
  const queryValidation = validateListQuery(req.query as unknown);
  if (!queryValidation.ok) {
    throw createHttpError(400, queryValidation.message);
  }

  const result = listImages(queryValidation.value);
  const items = result.items.map(toImageListItemResponse);
  return res.json({
    items,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      sort: result.sort,
      order: result.order,
    },
  });
});

router.get("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const image = findImageById(imageId);
  if (!image) {
    throw createHttpError(404, "画像が見つかりません。");
  }

  return res.json({ item: toImageListItemResponse(image) });
});

router.post("/", uploadImageFile, (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  if (!req.file) {
    throw createHttpError(400, "fileは必須です。");
  }
  ensureValidUploadedImageFile(req.file.path, req.file.originalname);

  let createdImage;
  try {
    createdImage = createImage({
      title: validationResult.value.title,
      author: validationResult.value.author,
      storedPath: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype || "application/octet-stream",
      fileSize: req.file.size,
    });
  } catch (error) {
    if (existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw error;
  }

  return res.status(201).json({ item: toImageListItemResponse(createdImage) });
});

router.patch("/:id", uploadImageFile, (req, res) => {
  const imageIdParam = req.params.id;
  if (typeof imageIdParam !== "string") {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const imageId = parsePositiveInt(imageIdParam);
  if (imageId === null) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown, {
    requireAtLeastOne: req.file === undefined,
  });
  if (!validationResult.ok) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, validationResult.message);
  }

  let updatedImage;
  try {
    if (req.file) {
      ensureValidUploadedImageFile(req.file.path, req.file.originalname);
      const updatePayload: Parameters<typeof updateImageWithHook>[1] = {
        storedPath: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
        fileSize: req.file.size,
      };
      if (validationResult.value.title !== undefined) {
        updatePayload.title = validationResult.value.title;
      }
      if (validationResult.value.author !== undefined) {
        updatePayload.author = validationResult.value.author;
      }

      updatedImage = updateImageWithHook(
        imageId,
        updatePayload,
        ({ previous, current }) => {
          if (previous.storedPath !== current.storedPath) {
            deleteStoredFile("images", previous.storedPath, { ignoreMissing: true });
          }
        }
      );
    } else {
      updatedImage = updateImage(imageId, validationResult.value);
    }
  } catch (error) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw error;
  }

  if (!updatedImage) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(404, "画像が見つかりません。");
  }

  return res.json({ item: toImageListItemResponse(updatedImage) });
});

router.delete("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const deleted = deleteImageWithHook(imageId, (image) => {
    deleteStoredFile("images", image.storedPath, { ignoreMissing: true });
  });
  if (!deleted) {
    throw createHttpError(404, "画像が見つかりません。");
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const image = findImageById(imageId);
  if (!image) {
    throw createHttpError(404, "画像が見つかりません。");
  }

  const absoluteFilePath = resolveStoredFilePath("images", image.storedPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "保存済み画像ファイルが見つかりません。");
  }

  return res.download(absoluteFilePath, image.originalName);
});

export default router;
