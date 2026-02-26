import { Router } from "express";
import {
  createModel,
  deleteModel,
  findModelById,
  listModels,
  type CreateModelInput,
  type ListModelsOptions,
  type UpdateModelInput,
  updateModel,
} from "../features/models/service.js";

const router = Router();

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

const parseId = (value: string): number | null => {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return parsedValue;
};

const validateListModelsQuery = (value: unknown): ValidationResult<ListModelsOptions> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Query must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const options: ListModelsOptions = {};

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

const validateCreateModelInput = (value: unknown): ValidationResult<CreateModelInput> => {
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

const validateUpdateModelInput = (value: unknown): ValidationResult<UpdateModelInput> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Request body must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const result: UpdateModelInput = {};

  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string" || candidate.title.trim() === "") {
      return { ok: false, message: "title must be a non-empty string when provided." };
    }
    result.title = candidate.title.trim();
  }

  if (candidate.author !== undefined) {
    if (typeof candidate.author !== "string" || candidate.author.trim() === "") {
      return { ok: false, message: "author must be a non-empty string when provided." };
    }
    result.author = candidate.author.trim();
  }

  if (candidate.filename !== undefined) {
    if (typeof candidate.filename !== "string" || candidate.filename.trim() === "") {
      return { ok: false, message: "filename must be a non-empty string when provided." };
    }
    result.filename = candidate.filename.trim();
  }

  if (Object.keys(result).length === 0) {
    return { ok: false, message: "At least one of title, author, filename is required." };
  }

  return { ok: true, value: result };
};

router.get("/", (req, res) => {
  const queryValidation = validateListModelsQuery(req.query as unknown);
  if (!queryValidation.ok) {
    return res.status(400).json({ error: queryValidation.message });
  }

  return res.json({ items: listModels(queryValidation.value) });
});

router.get("/:id", (req, res) => {
  const modelId = parseId(req.params.id);
  if (modelId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const model = findModelById(modelId);
  if (!model) {
    return res.status(404).json({ error: "Model not found." });
  }

  return res.json({ item: model });
});

router.post("/", (req, res) => {
  const validationResult = validateCreateModelInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const createdModel = createModel(validationResult.value);
  return res.status(201).json({ item: createdModel });
});

router.patch("/:id", (req, res) => {
  const modelId = parseId(req.params.id);
  if (modelId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const validationResult = validateUpdateModelInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const updatedModel = updateModel(modelId, validationResult.value);
  if (!updatedModel) {
    return res.status(404).json({ error: "Model not found." });
  }

  return res.json({ item: updatedModel });
});

router.delete("/:id", (req, res) => {
  const modelId = parseId(req.params.id);
  if (modelId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const deleted = deleteModel(modelId);
  if (!deleted) {
    return res.status(404).json({ error: "Model not found." });
  }

  return res.status(204).send();
});

router.get("/:id/download", (req, res) => {
  const modelId = parseId(req.params.id);
  if (modelId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const model = findModelById(modelId);
  if (!model) {
    return res.status(404).json({ error: "Model not found." });
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.attachment(model.filename);
  return res.send(`Mock model file content for ${model.filename}\n`);
});

export default router;
