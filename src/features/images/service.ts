import { db } from "../../db/database.js";
import type { Image } from "../../types/entities.js";
import type { ListSortField, ListSortOrder } from "../../utils/validators.js";

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
  author?: string;
  limit?: number;
  page?: number;
  sort?: ListSortField;
  order?: ListSortOrder;
};

export type ListImagesResult = {
  items: Image[];
  total: number;
  page: number;
  limit: number | null;
  sort: ListSortField;
  order: ListSortOrder;
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

const buildListFilter = (
  options: ListImagesOptions
): { whereClause: string; whereParams: string[] } => {
  const conditions: string[] = [];
  const whereParams: string[] = [];

  if (options.author) {
    conditions.push("LOWER(author) = LOWER(?)");
    whereParams.push(options.author);
  }

  if (options.q) {
    conditions.push("(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)");
    const loweredKeyword = `%${options.q.toLowerCase()}%`;
    whereParams.push(loweredKeyword, loweredKeyword);
  }

  if (conditions.length === 0) {
    return { whereClause: "", whereParams: [] };
  }

  return {
    whereClause: ` WHERE ${conditions.join(" AND ")}`,
    whereParams,
  };
};

const sortFieldToSqlColumn: Record<ListSortField, string> = {
  id: "id",
  createdAt: "created_at",
  title: "title",
};

export const listImages = (options: ListImagesOptions = {}): ListImagesResult => {
  const sort: ListSortField = options.sort ?? "id";
  const order: ListSortOrder = options.order ?? "desc";
  const page = options.page ?? 1;
  const limit = options.limit ?? null;
  const offset = limit === null ? 0 : (page - 1) * limit;

  const { whereClause, whereParams } = buildListFilter(options);
  const countSql = `SELECT COUNT(*) AS total FROM images${whereClause}`;
  const countRow = db.prepare(countSql).get(...whereParams) as { total: number };
  const total = Number(countRow.total ?? 0);

  let listSql = `${IMAGE_SELECT_SQL}${whereClause} ORDER BY ${sortFieldToSqlColumn[sort]} ${
    order === "asc" ? "ASC" : "DESC"
  }`;
  const listParams: Array<string | number> = [...whereParams];

  if (limit !== null) {
    listSql += " LIMIT ? OFFSET ?";
    listParams.push(limit, offset);
  }

  const items = db.prepare(listSql).all(...listParams) as Image[];
  return { items, total, page, limit, sort, order };
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
    throw new Error("画像の作成に失敗しました。");
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
