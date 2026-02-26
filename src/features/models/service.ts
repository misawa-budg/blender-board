import { db } from "../../db/database.js";
import type { Model } from "../../types/entities.js";

export type CreateModelInput = {
  title: string;
  author: string;
  storedPath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

export type UpdateModelInput = {
  title?: string;
  author?: string;
  storedPath?: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
};

export type ListModelsOptions = {
  q?: string;
  limit?: number;
};

type UpdateModelHookArgs = {
  previous: Model;
  current: Model;
};

type UpdateModelHook = (args: UpdateModelHookArgs) => void;
type DeleteModelHook = (model: Model) => void;

const MODEL_SELECT_SQL = `
  SELECT
    id,
    title,
    author,
    created_at AS createdAt,
    stored_path AS storedPath,
    original_name AS originalName,
    mime_type AS mimeType,
    file_size AS fileSize
  FROM models
`;

export const listModels = (options: ListModelsOptions = {}): Model[] => {
  let sql = MODEL_SELECT_SQL;
  const parameters: Array<string | number> = [];

  if (options.q) {
    const loweredKeyword = `%${options.q.toLowerCase()}%`;
    sql += " WHERE (LOWER(title) LIKE ? OR LOWER(author) LIKE ?)";
    parameters.push(loweredKeyword, loweredKeyword);
  }

  sql += " ORDER BY id DESC";

  if (typeof options.limit === "number") {
    sql += " LIMIT ?";
    parameters.push(options.limit);
  }

  return db.prepare(sql).all(...parameters) as Model[];
};

export const findModelById = (id: number): Model | undefined => {
  return db.prepare(`${MODEL_SELECT_SQL} WHERE id = ?`).get(id) as Model | undefined;
};

export const createModel = (input: CreateModelInput): Model => {
  const createdAt = new Date().toISOString();
  const insertResult = db
    .prepare(
      `
      INSERT INTO models (
        title,
        author,
        created_at,
        filename,
        stored_path,
        original_name,
        mime_type,
        file_size
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      input.title,
      input.author,
      createdAt,
      input.storedPath,
      input.storedPath,
      input.originalName,
      input.mimeType,
      input.fileSize
    );

  const modelId = Number(insertResult.lastInsertRowid);
  const createdModel = findModelById(modelId);
  if (!createdModel) {
    throw new Error("モデルの作成に失敗しました。");
  }

  return createdModel;
};

const updateModelInTransaction = (id: number, input: UpdateModelInput): Model | undefined => {
  const previousModel = findModelById(id);
  if (!previousModel) {
    return undefined;
  }

  const fields: string[] = [];
  const values: Array<string | number> = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title);
  }
  if (input.author !== undefined) {
    fields.push("author = ?");
    values.push(input.author);
  }
  if (input.storedPath !== undefined) {
    fields.push("stored_path = ?");
    values.push(input.storedPath);
  }
  if (input.originalName !== undefined) {
    fields.push("original_name = ?");
    values.push(input.originalName);
  }
  if (input.mimeType !== undefined) {
    fields.push("mime_type = ?");
    values.push(input.mimeType);
  }
  if (input.fileSize !== undefined) {
    fields.push("file_size = ?");
    values.push(input.fileSize);
  }

  if (fields.length === 0) {
    return previousModel;
  }

  db.prepare(`UPDATE models SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  return findModelById(id);
};

export const updateModel = (id: number, input: UpdateModelInput): Model | undefined => {
  const runUpdate = db.transaction(() => {
    return updateModelInTransaction(id, input);
  });

  return runUpdate();
};

export const deleteModel = (id: number): boolean => {
  const deleteResult = db.prepare("DELETE FROM models WHERE id = ?").run(id);
  return deleteResult.changes > 0;
};

export const updateModelWithHook = (
  id: number,
  input: UpdateModelInput,
  hook: UpdateModelHook
): Model | undefined => {
  const runUpdate = db.transaction(() => {
    const previousModel = findModelById(id);
    if (!previousModel) {
      return undefined;
    }

    const updatedModel = updateModelInTransaction(id, input);
    if (!updatedModel) {
      return undefined;
    }

    hook({ previous: previousModel, current: updatedModel });
    return updatedModel;
  });

  return runUpdate();
};

export const deleteModelWithHook = (id: number, hook: DeleteModelHook): boolean => {
  const runDelete = db.transaction(() => {
    const targetModel = findModelById(id);
    if (!targetModel) {
      return false;
    }

    db.prepare("DELETE FROM models WHERE id = ?").run(id);
    hook(targetModel);
    return true;
  });

  return runDelete();
};
