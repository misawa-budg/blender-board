import { existsSync, unlinkSync } from "node:fs";
import { extname } from "node:path";
import { Router } from "express";
import {
  createModel,
  deleteModelWithHook,
  findModelById,
  listModels,
  updateModel,
  updateModelWithHook,
} from "../features/models/service.js";
import { uploadModelFile } from "../middlewares/upload.js";
import {
  parsePositiveInt,
  validateCreateMediaInput,
  validateListQuery,
  validateUpdateMediaInput,
} from "../utils/validators.js";
import { createHttpError } from "../utils/httpError.js";
import { deleteStoredFile, resolveStoredFilePath } from "../utils/storage.js";
import { hasValidFileSignature } from "../utils/fileSignature.js";
import type { Model } from "../types/entities.js";

const router = Router();

type ModelListItemResponse = {
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

const webPreviewModelExtensions = new Set([".glb", ".gltf"]);

const isModelWebPreviewSupported = (originalName: string): boolean => {
  return webPreviewModelExtensions.has(extname(originalName).toLowerCase());
};

const resolveModelPreviewMimeType = (originalName: string, fallback: string): string => {
  const extension = extname(originalName).toLowerCase();
  if (extension === ".glb") {
    return "model/gltf-binary";
  }
  if (extension === ".gltf") {
    return "model/gltf+json";
  }
  return fallback;
};

const toModelListItemResponse = (model: Model): ModelListItemResponse => {
  const previewUrl = isModelWebPreviewSupported(model.originalName)
    ? `/api/models/${model.id}/preview`
    : null;

  return {
    id: model.id,
    title: model.title,
    author: model.author,
    createdAt: model.createdAt,
    originalName: model.originalName,
    mimeType: model.mimeType,
    fileSize: model.fileSize,
    previewUrl,
    downloadUrl: `/api/models/${model.id}/download`,
  };
};

const ensureValidUploadedModelFile = (filePath: string, originalName: string): void => {
  if (hasValidFileSignature("models", filePath, originalName)) {
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

  const result = listModels(queryValidation.value);
  const items = result.items.map(toModelListItemResponse);
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
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const model = findModelById(modelId);
  if (!model) {
    throw createHttpError(404, "モデルが見つかりません。");
  }

  return res.json({ item: toModelListItemResponse(model) });
});

router.post("/", uploadModelFile, (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  if (!req.file) {
    throw createHttpError(400, "fileは必須です。");
  }
  ensureValidUploadedModelFile(req.file.path, req.file.originalname);

  let createdModel;
  try {
    createdModel = createModel({
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

  return res.status(201).json({ item: toModelListItemResponse(createdModel) });
});

router.patch("/:id", uploadModelFile, (req, res) => {
  const modelIdParam = req.params.id;
  if (typeof modelIdParam !== "string") {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const modelId = parsePositiveInt(modelIdParam);
  if (modelId === null) {
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

  let updatedModel;
  try {
    if (req.file) {
      ensureValidUploadedModelFile(req.file.path, req.file.originalname);
      const updatePayload: Parameters<typeof updateModelWithHook>[1] = {
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

      updatedModel = updateModelWithHook(
        modelId,
        updatePayload,
        ({ previous, current }) => {
          if (previous.storedPath !== current.storedPath) {
            deleteStoredFile("models", previous.storedPath, { ignoreMissing: true });
          }
        }
      );
    } else {
      updatedModel = updateModel(modelId, validationResult.value);
    }
  } catch (error) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw error;
  }

  if (!updatedModel) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(404, "モデルが見つかりません。");
  }

  return res.json({ item: toModelListItemResponse(updatedModel) });
});

router.delete("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const deleted = deleteModelWithHook(modelId, (model) => {
    deleteStoredFile("models", model.storedPath, { ignoreMissing: true });
  });
  if (!deleted) {
    throw createHttpError(404, "モデルが見つかりません。");
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const model = findModelById(modelId);
  if (!model) {
    throw createHttpError(404, "モデルが見つかりません。");
  }

  const absoluteFilePath = resolveStoredFilePath("models", model.storedPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "保存済みモデルファイルが見つかりません。");
  }

  return res.download(absoluteFilePath, model.originalName);
});

router.get("/:id/preview", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const model = findModelById(modelId);
  if (!model) {
    throw createHttpError(404, "モデルが見つかりません。");
  }
  if (!isModelWebPreviewSupported(model.originalName)) {
    throw createHttpError(
      400,
      "このモデル形式はWebプレビュー未対応です。glb/gltfを使用してください。",
      "preview_not_supported"
    );
  }

  const absoluteFilePath = resolveStoredFilePath("models", model.storedPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "保存済みモデルファイルが見つかりません。");
  }

  res.type(resolveModelPreviewMimeType(model.originalName, model.mimeType));
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(absoluteFilePath);
});

export default router;
