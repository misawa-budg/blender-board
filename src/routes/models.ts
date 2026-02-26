import { existsSync, unlinkSync } from "node:fs";
import { Router } from "express";
import {
  createModel,
  deleteModel,
  findModelById,
  listModels,
  updateModel,
} from "../features/models/service.js";
import { uploadModelFile } from "../middlewares/upload.js";
import {
  parsePositiveInt,
  validateCreateMediaInput,
  validateListQuery,
  validateUpdateMediaInput,
} from "../utils/validators.js";
import { createHttpError } from "../utils/httpError.js";
import { resolveStoredFilePath } from "../utils/storage.js";

const router = Router();

router.get("/", (req, res) => {
  const queryValidation = validateListQuery(req.query as unknown);
  if (!queryValidation.ok) {
    throw createHttpError(400, queryValidation.message);
  }

  return res.json({ items: listModels(queryValidation.value) });
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

  return res.json({ item: model });
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

  return res.status(201).json({ item: createdModel });
});

router.patch("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  const updatedModel = updateModel(modelId, validationResult.value);
  if (!updatedModel) {
    throw createHttpError(404, "Model not found.");
  }

  return res.json({ item: updatedModel });
});

router.delete("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const deleted = deleteModel(modelId);
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
