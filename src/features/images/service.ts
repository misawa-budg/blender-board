import { db } from "../../db/database.js";
import type { Image } from "../../mockObjects.js";

export type CreateImageInput = {
  title: string;
  author: string;
  filename: string;
};

export type UpdateImageInput = {
  title?: string;
  author?: string;
  filename?: string;
};

export type ListImagesOptions = {
  q?: string;
  limit?: number;
};

const IMAGE_SELECT_SQL = `
  SELECT
    id,
    title,
    author,
    created_at AS createdAt,
    filename
  FROM images
`;

export const listImages = (options: ListImagesOptions = {}): Image[] => {
  let sql = IMAGE_SELECT_SQL;
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

  return db.prepare(sql).all(...parameters) as Image[];
};

export const findImageById = (id: number): Image | undefined => {
  return db.prepare(`${IMAGE_SELECT_SQL} WHERE id = ?`).get(id) as Image | undefined;
};

export const createImage = (input: CreateImageInput): Image => {
  const createdAt = new Date().toISOString();
  const insertResult = db
    .prepare(
      `
      INSERT INTO images (title, author, created_at, filename)
      VALUES (?, ?, ?, ?)
    `
    )
    .run(input.title, input.author, createdAt, input.filename);

  const imageId = Number(insertResult.lastInsertRowid);
  const createdImage = findImageById(imageId);
  if (!createdImage) {
    throw new Error("Failed to create image.");
  }

  return createdImage;
};

export const updateImage = (id: number, input: UpdateImageInput): Image | undefined => {
  const existingImage = findImageById(id);
  if (!existingImage) {
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
  if (input.filename !== undefined) {
    fields.push("filename = ?");
    values.push(input.filename);
  }

  if (fields.length > 0) {
    db.prepare(`UPDATE images SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  }

  return findImageById(id);
};

export const deleteImage = (id: number): boolean => {
  const deleteResult = db.prepare("DELETE FROM images WHERE id = ?").run(id);
  return deleteResult.changes > 0;
};
