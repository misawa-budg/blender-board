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
    downloadUrl: `/images/${image.id}/download`,
  };
};

router.get("/", (req, res) => {
  const queryValidation = validateListQuery(req.query as unknown);
  if (!queryValidation.ok) {
    throw createHttpError(400, queryValidation.message);
  }

  const items = listImages(queryValidation.value).map(toImageListItemResponse);
  return res.json({ items });
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

  return res.json({ item: toImageListItemResponse(image) });
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

  return res.status(201).json({ item: toImageListItemResponse(createdImage) });
});

router.patch("/:id", uploadImageFile, (req, res) => {
  const imageIdParam = req.params.id;
  if (typeof imageIdParam !== "string") {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    throw createHttpError(400, "id must be a positive integer.");
  }

  const imageId = parsePositiveInt(imageIdParam);
  if (imageId === null) {
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

  let updatedImage;
  try {
    if (req.file) {
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
    throw createHttpError(404, "Image not found.");
  }

  return res.json({ item: toImageListItemResponse(updatedImage) });
});

router.delete("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    throw createHttpError(400, "id must be a positive integer.");
  }

  const deleted = deleteImageWithHook(imageId, (image) => {
    deleteStoredFile("images", image.storedPath, { ignoreMissing: true });
  });
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
