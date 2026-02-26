import { Router } from "express";
import {
  createModel,
  deleteModel,
  findModelById,
  listModels,
  updateModel,
} from "../features/models/service.js";
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

  return res.json({ items: listModels(queryValidation.value) });
});

router.get("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
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
  const validationResult = validateCreateMediaInput(req.body as unknown);
  if (!validationResult.ok) {
    return res.status(400).json({ error: validationResult.message });
  }

  const createdModel = createModel(validationResult.value);
  return res.status(201).json({ item: createdModel });
});

router.patch("/:id", (req, res) => {
  const modelId = parsePositiveInt(req.params.id);
  if (modelId === null) {
    return res.status(400).json({ error: "id must be a positive integer." });
  }

  const validationResult = validateUpdateMediaInput(req.body as unknown);
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
  const modelId = parsePositiveInt(req.params.id);
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
  const modelId = parsePositiveInt(req.params.id);
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
