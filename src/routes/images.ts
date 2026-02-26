import { Router } from "express";
import {
  createImage,
  deleteImage,
  findImageById,
  listImages,
  updateImage,
} from "../features/images/service.js";
import {
  parsePositiveInt,
  validateCreateMediaInput,
  validateListQuery,
  validateUpdateMediaInput,
} from "../utils/validators.js";

const router = Router();

router.get("/", (req, res) => {
  const queryValidation = validateListQuery(req.query as unknown);
  if (!queryValidation.ok) {
    return res.status(400).json({ error: queryValidation.message });
  }

  return res.json({ items: listImages(queryValidation.value) });
});

router.get("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const image = findImageById(imageId);
  if (!image) {
    return res.status(404).json({ error: "Image not found." });
  }

  return res.json({ item: image });
});

router.post("/", (req, res) => {
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const createdImage = createImage(validationResult.value);
  return res.status(201).json({ item: createdImage });
});

router.patch("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const updatedImage = updateImage(imageId, validationResult.value);
  if (!updatedImage) {
    return res.status(404).json({ error: "Image not found." });
  }

  return res.json({ item: updatedImage });
});

router.delete("/:id", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const deleted = deleteImage(imageId);
  if (!deleted) {
    return res.status(404).json({ error: "Image not found." });
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const imageId = parsePositiveInt(req.params.id);
  if (imageId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const image = findImageById(imageId);
  if (!image) {
    return res.status(404).json({ error: "Image not found." });
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.attachment(image.filename);
  return res.send(`Mock image file content for ${image.filename}\n`);
});

export default router;
