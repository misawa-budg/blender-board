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
};

export type ListModelsOptions = {
  q?: string;
  limit?: number;
};

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
    throw new Error("Failed to create model.");
  }

  return createdModel;
};

export const updateModel = (id: number, input: UpdateModelInput): Model | undefined => {
  const existingModel = findModelById(id);
  if (!existingModel) {
    return undefined;
  }

  const fields: string[] = [];
  const values: string[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title);
  }
  if (input.author !== undefined) {
    fields.push("author = ?");
    values.push(input.author);
  }

  if (fields.length > 0) {
    db.prepare(`UPDATE models SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  }

  return findModelById(id);
};

export const deleteModel = (id: number): boolean => {
  const deleteResult = db.prepare("DELETE FROM models WHERE id = ?").run(id);
  return deleteResult.changes > 0;
};
