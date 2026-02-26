import { db } from "../../db/database.js";
import type { Model } from "../../types/entities.js";
import type { ListSortField, ListSortOrder } from "../../utils/validators.js";

export type CreateModelInput = {
  title: string;
  author: string;
  storedPath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  previewStoredPath?: string;
  previewOriginalName?: string;
  previewMimeType?: string;
  previewFileSize?: number;
};

export type UpdateModelInput = {
  title?: string;
  author?: string;
  storedPath?: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
  previewStoredPath?: string;
  previewOriginalName?: string;
  previewMimeType?: string;
  previewFileSize?: number;
};

export type ListModelsOptions = {
  q?: string;
  author?: string;
  limit?: number;
  page?: number;
  sort?: ListSortField;
  order?: ListSortOrder;
};

export type ListModelsResult = {
  items: Model[];
  total: number;
  page: number;
  limit: number | null;
  sort: ListSortField;
  order: ListSortOrder;
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
    file_size AS fileSize,
    NULLIF(preview_stored_path, '') AS previewStoredPath,
    NULLIF(preview_original_name, '') AS previewOriginalName,
    NULLIF(preview_mime_type, '') AS previewMimeType,
    CASE
      WHEN preview_file_size > 0 THEN preview_file_size
      ELSE NULL
    END AS previewFileSize
  FROM models
`;

const buildListFilter = (
  options: ListModelsOptions
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

export const listModels = (options: ListModelsOptions = {}): ListModelsResult => {
  const sort: ListSortField = options.sort ?? "id";
  const order: ListSortOrder = options.order ?? "desc";
  const page = options.page ?? 1;
  const limit = options.limit ?? null;
  const offset = limit === null ? 0 : (page - 1) * limit;

  const { whereClause, whereParams } = buildListFilter(options);
  const countSql = `SELECT COUNT(*) AS total FROM models${whereClause}`;
  const countRow = db.prepare(countSql).get(...whereParams) as { total: number };
  const total = Number(countRow.total ?? 0);

  let listSql = `${MODEL_SELECT_SQL}${whereClause} ORDER BY ${sortFieldToSqlColumn[sort]} ${
    order === "asc" ? "ASC" : "DESC"
  }`;
  const listParams: Array<string | number> = [...whereParams];

  if (limit !== null) {
    listSql += " LIMIT ? OFFSET ?";
    listParams.push(limit, offset);
  }

  const items = db.prepare(listSql).all(...listParams) as Model[];
  return { items, total, page, limit, sort, order };
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
        file_size,
        preview_stored_path,
        preview_original_name,
        preview_mime_type,
        preview_file_size
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.fileSize,
      input.previewStoredPath ?? "",
      input.previewOriginalName ?? "",
      input.previewMimeType ?? "",
      input.previewFileSize ?? 0
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
  if (input.previewStoredPath !== undefined) {
    fields.push("preview_stored_path = ?");
    values.push(input.previewStoredPath);
  }
  if (input.previewOriginalName !== undefined) {
    fields.push("preview_original_name = ?");
    values.push(input.previewOriginalName);
  }
  if (input.previewMimeType !== undefined) {
    fields.push("preview_mime_type = ?");
    values.push(input.previewMimeType);
  }
  if (input.previewFileSize !== undefined) {
    fields.push("preview_file_size = ?");
    values.push(input.previewFileSize);
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
