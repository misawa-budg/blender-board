export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type ListQueryOptions = {
  q?: string;
  limit?: number;
};

export type MediaCreateInput = {
  title: string;
  author: string;
  filename: string;
};

export type MediaUpdateInput = {
  title?: string;
  author?: string;
  filename?: string;
};

export const parsePositiveInt = (value: string): number | null => {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return parsedValue;
};

export const validateListQuery = (value: unknown): ValidationResult<ListQueryOptions> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Query must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const options: ListQueryOptions = {};

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

export const validateCreateMediaInput = (
  value: unknown
): ValidationResult<MediaCreateInput> => {
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

export const validateUpdateMediaInput = (
  value: unknown
): ValidationResult<MediaUpdateInput> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "Request body must be an object." };
  }

  const candidate = value as Record<string, unknown>;
  const result: MediaUpdateInput = {};

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
