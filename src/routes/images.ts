import { existsSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { Router } from "express";
import {
  createImage,
  deleteImageWithHook,
  findImageById,
  listImages,
  updateImage,
  updateImageWithHook,
} from "../features/images/service.js";
import {
  findMissingModelIds,
  listModelsByImageId,
  replaceImageModelLinks,
} from "../features/imageModelLinks/service.js";
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

const createPreviewVersion = (storedPath: string): string => {
  return createHash("sha1").update(storedPath).digest("hex").slice(0, 12);
};

type ImageListItemResponse = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string;
  downloadUrl: string;
};

type LinkedModelResponse = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string | null;
  downloadUrl: string;
};

const toImageListItemResponse = (image: Image): ImageListItemResponse => {
  const previewVersion = createPreviewVersion(image.storedPath);
  return {
    id: image.id,
    title: image.title,
    author: image.author,
    createdAt: image.createdAt,
    originalName: image.originalName,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    previewUrl: `/api/images/${image.id}/preview?v=${previewVersion}`,
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

const parseModelIdsInput = (
  value: unknown
): { ok: true; value: number[]; provided: boolean } | { ok: false; message: string } => {
  if (value === undefined) {
    return { ok: true, value: [], provided: false };
  }

  const collectFromString = (input: string): string[] => {
    const trimmed = input.trim();
    if (trimmed === "") {
      return [];
    }
    if (trimmed.startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return ["__invalid_json__"];
      }
      if (!Array.isArray(parsed)) {
        return ["__invalid_json__"];
      }
      return parsed.map((item) => String(item));
    }
    return trimmed.split(",").map((item) => item.trim());
  };

  let rawItems: string[];
  if (typeof value === "string") {
    rawItems = collectFromString(value);
  } else if (Array.isArray(value)) {
    rawItems = value.map((item) => String(item).trim());
  } else {
    return { ok: false, message: "modelIdsは配列またはカンマ区切り文字列で指定してください。" };
  }

  if (rawItems.includes("__invalid_json__")) {
    return { ok: false, message: "modelIdsのJSON形式が不正です。" };
  }

  const modelIds: number[] = [];
  for (const rawItem of rawItems) {
    if (rawItem === "") {
      continue;
    }
    const parsedId = parsePositiveInt(rawItem);
    if (parsedId === null) {
      return { ok: false, message: "modelIdsには正の整数を指定してください。" };
    }
    modelIds.push(parsedId);
  }

  return { ok: true, value: [...new Set(modelIds)], provided: true };
};

const toLinkedModelResponse = (model: {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  hasPreview: number;
}): LinkedModelResponse => {
  const extension = model.originalName.toLowerCase();
  const previewSupported =
    model.hasPreview === 1 || extension.endsWith(".glb") || extension.endsWith(".gltf");
  return {
    id: model.id,
    title: model.title,
    author: model.author,
    createdAt: model.createdAt,
    originalName: model.originalName,
    mimeType: model.mimeType,
    fileSize: model.fileSize,
    previewUrl: previewSupported ? `/api/models/${model.id}/preview` : null,
    downloadUrl: `/api/models/${model.id}/download`,
  };
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

  const relatedModels = listModelsByImageId(image.id).map(toLinkedModelResponse);
  return res.json({ item: toImageListItemResponse(image), relatedModels });
});

router.post("/", uploadImageFile, (req, res) => {
  const bodyCandidate =
    typeof req.body === "object" && req.body !== null
      ? (req.body as Record<string, unknown>)
      : undefined;
  const modelIdsResult = parseModelIdsInput(bodyCandidate?.modelIds);
  if (!modelIdsResult.ok) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, modelIdsResult.message);
  }

  if (modelIdsResult.provided) {
    const missingModelIds = findMissingModelIds(modelIdsResult.value);
    if (missingModelIds.length > 0) {
      if (req.file && existsSync(req.file.path)) {
        unlinkSync(req.file.path);
      }
      throw createHttpError(
        400,
        `存在しないmodelIdがあります: ${missingModelIds.join(", ")}`,
        "model_not_found"
      );
    }
  }

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
    if (modelIdsResult.provided) {
      replaceImageModelLinks(createdImage.id, modelIdsResult.value);
    }
  } catch (error) {
    if (existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw error;
  }

  return res.status(201).json({ item: toImageListItemResponse(createdImage) });
});

router.patch("/:id", uploadImageFile, (req, res) => {
  const bodyCandidate =
    typeof req.body === "object" && req.body !== null
      ? (req.body as Record<string, unknown>)
      : undefined;
  const modelIdsResult = parseModelIdsInput(bodyCandidate?.modelIds);
  if (!modelIdsResult.ok) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, modelIdsResult.message);
  }
  if (modelIdsResult.provided) {
    const missingModelIds = findMissingModelIds(modelIdsResult.value);
    if (missingModelIds.length > 0) {
      if (req.file && existsSync(req.file.path)) {
        unlinkSync(req.file.path);
      }
      throw createHttpError(
        400,
        `存在しないmodelIdがあります: ${missingModelIds.join(", ")}`,
        "model_not_found"
      );
    }
  }

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
    requireAtLeastOne: false,
  });
  if (!validationResult.ok) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, validationResult.message);
  }
  const hasMediaBodyUpdates =
    validationResult.value.title !== undefined || validationResult.value.author !== undefined;
  if (!hasMediaBodyUpdates && req.file === undefined && !modelIdsResult.provided) {
    throw createHttpError(400, "titleまたはauthor、file、modelIdsのいずれかを指定してください。");
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
      updatedImage = hasMediaBodyUpdates ? updateImage(imageId, validationResult.value) : findImageById(imageId);
    }
    if (updatedImage && modelIdsResult.provided) {
      replaceImageModelLinks(updatedImage.id, modelIdsResult.value);
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

router.get("/:id/preview", (req, res) => {
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

  res.type(image.mimeType);
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(absoluteFilePath);
});

export default router;
