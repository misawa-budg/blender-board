import { existsSync, unlinkSync } from "node:fs";
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
  downloadUrl: string;
};

const toModelListItemResponse = (model: Model): ModelListItemResponse => {
  return {
    id: model.id,
    title: model.title,
    author: model.author,
    createdAt: model.createdAt,
    originalName: model.originalName,
    mimeType: model.mimeType,
    fileSize: model.fileSize,
    downloadUrl: `/models/${model.id}/download`,
  };
};

router.get("/", (req, res) => {
  const queryValidation = validateListQuery(req.query as unknown);
  if (!queryValidation.ok) {
    throw createHttpError(400, queryValidation.message);
  }

  const items = listModels(queryValidation.value).map(toModelListItemResponse);
  return res.json({ items });
});

router.get("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const model = findModelById(modelId);
  if (!model) {
    throw createHttpError(404, "Model not found.");
  }

  return res.json({ item: toModelListItemResponse(model) });
});

router.post("/", uploadModelFile, (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  if (!req.file) {
    throw createHttpError(400, "file is required.");
  }

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
    throw createHttpError(400, "id must be a positive integer.");
  }

  const modelId = parsePositiveInt(modelIdParam);
  if (modelId === null) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, "id must be a positive integer.");
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
    throw createHttpError(404, "Model not found.");
  }

  return res.json({ item: toModelListItemResponse(updatedModel) });
});

router.delete("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const deleted = deleteModelWithHook(modelId, (model) => {
    deleteStoredFile("models", model.storedPath, { ignoreMissing: true });
  });
  if (!deleted) {
    throw createHttpError(404, "Model not found.");
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const model = findModelById(modelId);
  if (!model) {
    throw createHttpError(404, "Model not found.");
  }

  const absoluteFilePath = resolveStoredFilePath("models", model.storedPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "Stored model file not found.");
  }

  return res.download(absoluteFilePath, model.originalName);
});

export default router;
