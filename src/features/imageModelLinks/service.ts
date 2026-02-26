import { db } from "../../db/database.js";

export type LinkedModelSummary = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

export type LinkedImageSummary = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

const normalizeModelIds = (modelIds: number[]): number[] => {
  return [...new Set(modelIds)].sort((a, b) => a - b);
};

export const findMissingModelIds = (modelIds: number[]): number[] => {
  const normalizedModelIds = normalizeModelIds(modelIds);
  if (normalizedModelIds.length === 0) {
    return [];
  }

  const placeholders = normalizedModelIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT id FROM models WHERE id IN (${placeholders})`)
    .all(...normalizedModelIds) as Array<{ id: number }>;
  const existingModelIds = new Set(rows.map((row) => row.id));

  return normalizedModelIds.filter((modelId) => !existingModelIds.has(modelId));
};

export const replaceImageModelLinks = (imageId: number, modelIds: number[]): void => {
  const normalizedModelIds = normalizeModelIds(modelIds);
  const replace = db.transaction(() => {
    db.prepare("DELETE FROM image_model_links WHERE image_id = ?").run(imageId);

    if (normalizedModelIds.length === 0) {
      return;
    }

    const insert = db.prepare(
      "INSERT INTO image_model_links (image_id, model_id) VALUES (?, ?)"
    );
    for (const modelId of normalizedModelIds) {
      insert.run(imageId, modelId);
    }
  });

  replace();
};

export const listModelsByImageId = (imageId: number): LinkedModelSummary[] => {
  return db
    .prepare(
      `
      SELECT
        m.id AS id,
        m.title AS title,
        m.author AS author,
        m.created_at AS createdAt,
        m.original_name AS originalName,
        m.mime_type AS mimeType,
        m.file_size AS fileSize
      FROM image_model_links AS l
      INNER JOIN models AS m ON m.id = l.model_id
      WHERE l.image_id = ?
      ORDER BY m.id DESC
    `
    )
    .all(imageId) as LinkedModelSummary[];
};

export const listImagesByModelId = (modelId: number): LinkedImageSummary[] => {
  return db
    .prepare(
      `
      SELECT
        i.id AS id,
        i.title AS title,
        i.author AS author,
        i.created_at AS createdAt,
        i.original_name AS originalName,
        i.mime_type AS mimeType,
        i.file_size AS fileSize
      FROM image_model_links AS l
      INNER JOIN images AS i ON i.id = l.image_id
      WHERE l.model_id = ?
      ORDER BY i.id DESC
    `
    )
    .all(modelId) as LinkedImageSummary[];
};
