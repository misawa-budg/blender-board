import { Router } from "express";
import {
  createImage,
  findImageById,
  listImages,
  type CreateImageInput,
  type ListImagesOptions,
} from "../features/images/service.js";

const router = Router();

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

const parseId = (value: string): number | null => {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return parsedValue;
};

const validateListImagesQuery = (value: unknown): ValidationResult<ListImagesOptions> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Query must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const options: ListImagesOptions = {};

  if (typeof candidate.q === "string") {
    const trimmedValue = candidate.q.trim();
    if (trimmedValue.length > 0) {
      options.q = trimmedValue;
    }
  }

  if (candidate.limit !== undefined) {
    if (typeof candidate.limit !== "string") {
      return { ok: false, message: "limit must be a positive integer." };
    }

    const parsedLimit = Number.parseInt(candidate.limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      return { ok: false, message: "limit must be between 1 and 100." };
    }

    options.limit = parsedLimit;
  }

  return { ok: true, value: options };
};

const validateCreateImageInput = (value: unknown): ValidationResult<CreateImageInput> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Request body must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const title = candidate.title;
  const author = candidate.author;
  const filename = candidate.filename;

  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, message: "title is required and must be a non-empty string." };
  }

  if (typeof author !== "string" || author.trim() === "") {
    return { ok: false, message: "author is required and must be a non-empty string." };
  }

  if (typeof filename !== "string" || filename.trim() === "") {
    return { ok: false, message: "filename is required and must be a non-empty string." };
  }

  return {
    ok: true,
    value: {
      title: title.trim(),
      author: author.trim(),
      filename: filename.trim(),
    },
  };
};

router.get("/", (_req, res) => {
  const queryValidation = validateListImagesQuery(_req.query as unknown);
  if (!queryValidation.ok) {
    return res.status(400).json({ error: queryValidation.message });
  }

  return res.json({ items: listImages(queryValidation.value) });
});

router.get("/:id", (req, res) => {
  const imageId = parseId(req.params.id);
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
  const validationResult = validateCreateImageInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const createdImage = createImage(validationResult.value);
  return res.status(201).json({ item: createdImage });
});

router.get("/:id/download", (req, res) => {
  const imageId = parseId(req.params.id);
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
