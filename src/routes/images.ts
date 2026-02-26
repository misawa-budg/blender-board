import { existsSync, unlinkSync } from "node:fs";
import { Router } from "express";
import {
  createImage,
  deleteImage,
  findImageById,
  listImages,
  updateImage,
} from "../features/images/service.js";
import { uploadImageFile } from "../middlewares/upload.js";
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

  return res.json({ items: listImages(queryValidation.value) });
});

router.get("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const image = findImageById(imageId);
  if (!image) {
    throw createHttpError(404, "Image not found.");
  }

  return res.json({ item: image });
});

router.post("/", uploadImageFile, (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  if (!req.file) {
    throw createHttpError(400, "file is required.");
  }

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

  return res.status(201).json({ item: createdImage });
});

router.patch("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    throw createHttpError(400, validationResult.message);
  }

  const updatedImage = updateImage(imageId, validationResult.value);
  if (!updatedImage) {
    throw createHttpError(404, "Image not found.");
  }

  return res.json({ item: updatedImage });
});

router.delete("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const deleted = deleteImage(imageId);
  if (!deleted) {
    throw createHttpError(404, "Image not found.");
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const image = findImageById(imageId);
  if (!image) {
    throw createHttpError(404, "Image not found.");
  }

  const absoluteFilePath = resolveStoredFilePath("images", image.storedPath);
  if (!existsSync(absoluteFilePath)) {
    throw createHttpError(404, "Stored image file not found.");
  }

  return res.download(absoluteFilePath, image.originalName);
});

export default router;
