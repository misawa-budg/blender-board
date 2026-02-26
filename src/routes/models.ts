import { existsSync, unlinkSync } from "node:fs";
import { extname } from "node:path";
import { Router } from "express";
import type { Request } from "express";
import {
  createModel,
  deleteModelWithHook,
  findModelById,
  listModels,
  updateModel,
  updateModelWithHook,
} from "../features/models/service.js";
import { listImagesByModelId } from "../features/imageModelLinks/service.js";
import { uploadModelFiles } from "../middlewares/upload.js";
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

type LinkedImageResponse = {
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

type UploadedModelFiles = {
  sourceFile: Express.Multer.File | undefined;
  previewFile: Express.Multer.File | undefined;
};

const getUploadedModelFiles = (req: Request): UploadedModelFiles => {
  const filesValue = req.files;
  if (!filesValue || Array.isArray(filesValue)) {
    return { sourceFile: undefined, previewFile: undefined };
  }

  const sourceFiles = filesValue.file;
  const previewFiles = filesValue.previewFile;
  return {
    sourceFile: Array.isArray(sourceFiles) ? sourceFiles[0] : undefined,
    previewFile: Array.isArray(previewFiles) ? previewFiles[0] : undefined,
  };
};

const deleteFileIfExists = (filePath: string | undefined): void => {
  if (!filePath) {
    return;
  }
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
};

const toModelListItemResponse = (model: Model): ModelListItemResponse => {
  const hasDedicatedPreview = typeof model.previewStoredPath === "string" && model.previewStoredPath !== "";
  const previewUrl = hasDedicatedPreview || isModelWebPreviewSupported(model.originalName)
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

const toLinkedImageResponse = (item: {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}): LinkedImageResponse => {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    createdAt: item.createdAt,
    originalName: item.originalName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    previewUrl: `/api/images/${item.id}/preview`,
    downloadUrl: `/api/images/${item.id}/download`,
  };
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

  const relatedImages = listImagesByModelId(model.id).map(toLinkedImageResponse);
  return res.json({ item: toModelListItemResponse(model), relatedImages });
});

router.post("/", uploadModelFiles, (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  const { sourceFile, previewFile } = getUploadedModelFiles(req);

  if (!sourceFile) {
    deleteFileIfExists(previewFile?.path);
    throw createHttpError(400, "fileは必須です。");
  }
  ensureValidUploadedModelFile(sourceFile.path, sourceFile.originalname);
  if (previewFile) {
    ensureValidUploadedModelFile(previewFile.path, previewFile.originalname);
  }

  let createdModel;
  try {
    createdModel = createModel({
      title: validationResult.value.title,
      author: validationResult.value.author,
      storedPath: sourceFile.filename,
      originalName: sourceFile.originalname,
      mimeType: sourceFile.mimetype || "application/octet-stream",
      fileSize: sourceFile.size,
      previewStoredPath: previewFile?.filename ?? "",
      previewOriginalName: previewFile?.originalname ?? "",
      previewMimeType: previewFile?.mimetype ?? "",
      previewFileSize: previewFile?.size ?? 0,
    });
  } catch (error) {
    deleteFileIfExists(sourceFile.path);
    deleteFileIfExists(previewFile?.path);
    throw error;
  }

  return res.status(201).json({ item: toModelListItemResponse(createdModel) });
});

router.patch("/:id", uploadModelFiles, (req, res) => {
  const modelIdParam = req.params.id;
  const { sourceFile, previewFile } = getUploadedModelFiles(req);

  if (typeof modelIdParam !== "string") {
    deleteFileIfExists(sourceFile?.path);
    deleteFileIfExists(previewFile?.path);
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const modelId = parsePositiveInt(modelIdParam);
  if (modelId === null) {
    deleteFileIfExists(sourceFile?.path);
    deleteFileIfExists(previewFile?.path);
    throw createHttpError(400, "idは正の整数で指定してください。");
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown, {
    requireAtLeastOne: sourceFile === undefined && previewFile === undefined,
  });
  if (!validationResult.ok) {
    deleteFileIfExists(sourceFile?.path);
    deleteFileIfExists(previewFile?.path);
    throw createHttpError(400, validationResult.message);
  }

  let updatedModel;
  try {
    if (sourceFile || previewFile) {
      if (sourceFile) {
        ensureValidUploadedModelFile(sourceFile.path, sourceFile.originalname);
      }
      if (previewFile) {
        ensureValidUploadedModelFile(previewFile.path, previewFile.originalname);
      }
      const updatePayload: Parameters<typeof updateModelWithHook>[1] = {
        ...(sourceFile
          ? {
              storedPath: sourceFile.filename,
              originalName: sourceFile.originalname,
              mimeType: sourceFile.mimetype || "application/octet-stream",
              fileSize: sourceFile.size,
            }
          : {}),
        ...(previewFile
          ? {
              previewStoredPath: previewFile.filename,
              previewOriginalName: previewFile.originalname,
              previewMimeType: previewFile.mimetype || "application/octet-stream",
              previewFileSize: previewFile.size,
            }
          : {}),
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
          if (
            previous.previewStoredPath &&
            previous.previewStoredPath !== current.previewStoredPath
          ) {
            deleteStoredFile("models", previous.previewStoredPath, { ignoreMissing: true });
          }
        }
      );
    } else {
      updatedModel = updateModel(modelId, validationResult.value);
    }
  } catch (error) {
    deleteFileIfExists(sourceFile?.path);
    deleteFileIfExists(previewFile?.path);
    throw error;
  }

  if (!updatedModel) {
    deleteFileIfExists(sourceFile?.path);
    deleteFileIfExists(previewFile?.path);
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
    if (model.previewStoredPath) {
      deleteStoredFile("models", model.previewStoredPath, { ignoreMissing: true });
    }
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
  const hasDedicatedPreview = typeof model.previewStoredPath === "string" && model.previewStoredPath !== "";
  if (!hasDedicatedPreview && !isModelWebPreviewSupported(model.originalName)) {
    throw createHttpError(
      400,
      "このモデル形式はWebプレビュー未対応です。glb/gltfを使用してください。",
      "preview_not_supported"
    );
  }

  const previewStoredPath =
    hasDedicatedPreview ? model.previewStoredPath ?? model.storedPath : model.storedPath;
  const previewOriginalName = hasDedicatedPreview
    ? model.previewOriginalName ?? model.originalName
    : model.originalName;
  const previewMimeType = hasDedicatedPreview
    ? model.previewMimeType ?? model.mimeType
    : model.mimeType;

  const absoluteFilePath = resolveStoredFilePath("models", previewStoredPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "保存済みモデルファイルが見つかりません。");
  }

  res.type(resolveModelPreviewMimeType(previewOriginalName, previewMimeType));
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(absoluteFilePath);
});

export default router;
