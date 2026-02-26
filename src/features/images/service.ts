import { db } from "../../db/database.js";
import type { Image } from "../../types/entities.js";

export type CreateImageInput = {
  title: string;
  author: string;
  storedPath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

export type UpdateImageInput = {
  title?: string;
  author?: string;
  storedPath?: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
};

export type ListImagesOptions = {
  q?: string;
  limit?: number;
};

type UpdateImageHookArgs = {
  previous: Image;
  current: Image;
};

type UpdateImageHook = (args: UpdateImageHookArgs) => void;
type DeleteImageHook = (image: Image) => void;

const IMAGE_SELECT_SQL = `
  SELECT
    id,
    title,
    author,
    created_at AS createdAt,
    stored_path AS storedPath,
    original_name AS originalName,
    mime_type AS mimeType,
    file_size AS fileSize
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
      INSERT INTO images (
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

  const imageId = Number(insertResult.lastInsertRowid);
  const createdImage = findImageById(imageId);
  if (!createdImage) {
    throw new Error("Failed to create image.");
  }

  return createdImage;
};

const updateImageInTransaction = (id: number, input: UpdateImageInput): Image | undefined => {
  const previousImage = findImageById(id);
  if (!previousImage) {
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
    return previousImage;
  }

  db.prepare(`UPDATE images SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  return findImageById(id);
};

export const updateImage = (id: number, input: UpdateImageInput): Image | undefined => {
  const runUpdate = db.transaction(() => {
    return updateImageInTransaction(id, input);
  });

  return runUpdate();
};

export const updateImageWithHook = (
  id: number,
  input: UpdateImageInput,
  hook: UpdateImageHook
): Image | undefined => {
  const runUpdate = db.transaction(() => {
    const previousImage = findImageById(id);
    if (!previousImage) {
      return undefined;
    }

    const updatedImage = updateImageInTransaction(id, input);
    if (!updatedImage) {
      return undefined;
    }

    hook({ previous: previousImage, current: updatedImage });
    return updatedImage;
  });

  return runUpdate();
};

export const deleteImage = (id: number): boolean => {
  const deleteResult = db.prepare("DELETE FROM images WHERE id = ?").run(id);
  return deleteResult.changes > 0;
};

export const deleteImageWithHook = (id: number, hook: DeleteImageHook): boolean => {
  const runDelete = db.transaction(() => {
    const targetImage = findImageById(id);
    if (!targetImage) {
      return false;
    }

    db.prepare("DELETE FROM images WHERE id = ?").run(id);
    hook(targetImage);
    return true;
  });

  return runDelete();
};
